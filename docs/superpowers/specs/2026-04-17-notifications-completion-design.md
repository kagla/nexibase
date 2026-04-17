# Notifications Completion — Design

- **Date:** 2026-04-17
- **Status:** Approved (brainstorming → writing-plans)
- **Scope type:** Overview spec for a single phase (Phase 1). Out-of-scope items are listed in §1.3 and may become separate specs later.

## 1. Goals and Scope

### 1.1 Goal

Bring the core notification system from "order-only" to a general-purpose notification substrate that covers community interactions (comments, replies, mentions) and admin-to-user direct messaging, while establishing a clear core API so plugins can emit their own notifications without touching core code.

### 1.2 In scope (Phase 1)

- Comment / reply / mention notifications triggered from the boards plugin.
- Per-user notification preferences (per-type in-app on/off + per-type email on/off).
- `/mypage/notifications` page polish: delete actions, filter tabs, pagination, relative time.
- New `/mypage/settings/notifications` preferences page.
- **Admin-to-user free-form notification**: admin (or manager) sends a one-shot notification to a specific user from the user-admin page or order-admin page, with optional email.
- Core notification API surface (`createNotification`, `createPostCommentNotification`, `createCommentReplyNotification`, `createMentionNotification`, `shouldNotify`) for plugin consumption.

### 1.3 Out of scope (not in Phase 1)

- Direct messaging (threaded 1:1 DM). May become a separate `messaging` plugin later.
- Block / mute system. Only meaningful with DM; deferred with DM.
- Admin broadcast / mass announcement. Dropped — too risky with large user bases.
- Real-time push (SSE / WebSocket / Web Push). Keep existing 60-second polling; compatible with any host.
- Bulk multi-user admin sends. Easy to add later; not required for Phase 1.

### 1.4 Design principles

- Don't modify `prisma/schema.prisma` directly — it is a generated artifact. Edit `prisma/schema.base.prisma` for core models.
- Plugins call core notification helpers; plugins never own notification storage.
- The core notification helpers read user preferences and skip silently when the user opts out — plugins stay ignorant of preferences.
- Keep polling. No server-push infrastructure dependency.

## 2. Architecture

### 2.1 Responsibility split

| Layer | Responsibility |
|---|---|
| Core (`src/lib/notification.ts`, `src/app/api/notifications/*`) | Notification CRUD, create-helpers, preferences, mention parser, admin-send endpoint |
| Plugins (`src/plugins/boards/...`) | Hook into their own events (e.g. comment create) and call core create-helpers |
| UI | Header dropdown (existing), `/mypage/notifications` (revised), `/mypage/settings/notifications` (new), admin send dialog (new) |

### 2.2 Core API surface (contract for plugins)

```ts
// src/lib/notification.ts
createNotification({ userId, type, title, message, link? })
createPostCommentNotification({ userId, fromUserName, postTitle, postLink })
createCommentReplyNotification({ userId, fromUserName, postTitle, postLink })
createMentionNotification({ userId, fromUserName, postTitle, postLink, excerpt })
shouldNotify(userId, type): Promise<boolean>

// src/lib/mentions.ts
parseMentions(content: string): string[]        // "@alice @밥" → ["alice", "밥"]
resolveMentions(nicknames: string[]): Promise<User[]>
```

All `create*` functions consult the user's `NotificationPreference` and silently return `null` when that type is disabled. Email dispatch also obeys the per-type email flag.

### 2.3 Delivery model

- **Generation:** synchronous DB insert at event time (existing pattern).
- **Email:** fire-and-forget when per-type email flag is on.
- **Client refresh:**
  - Header dropdown keeps 60-second polling on `/api/notifications/count`.
  - `/mypage/notifications` fetches once on mount + on filter change + on "load more".
- No SSE/WebSocket.

### 2.4 File map

```
src/lib/notification.ts                                  modify — add helpers + preference guard
src/lib/mentions.ts                                      new — parser + resolver
src/lib/notification-types.ts                            new — NotificationType constants
src/app/api/notifications/route.ts                       keep as-is
src/app/api/notifications/count/route.ts                 keep as-is
src/app/api/notifications/preferences/route.ts           new — GET/PUT
src/app/api/admin/notifications/send/route.ts            new — POST
src/app/[locale]/mypage/notifications/page.tsx           modify — filters, delete, pagination, relative time
src/app/[locale]/mypage/settings/notifications/page.tsx  new — preferences UI
src/components/admin/SendNotificationDialog.tsx          new — reusable dialog
src/plugins/boards/api/posts/[id]/comments/route.ts      modify — trigger notifications
src/lib/email.ts                                         modify — add sendAdminMessageEmail
prisma/schema.base.prisma                                modify — add NotificationPreference
```

## 3. Data model

### 3.1 Existing `Notification` — unchanged

`type` is a free-form `VARCHAR(50)`, so new types can be added without schema change.

### 3.2 New `NotificationPreference`

```prisma
model NotificationPreference {
  id                Int      @id @default(autoincrement())
  userId            Int      @unique
  postComment       Boolean  @default(true)
  commentReply      Boolean  @default(true)
  mention           Boolean  @default(true)
  orderStatus       Boolean  @default(true)
  // NOTE: no `adminMessage` field — admin free-form notifications are always
  // delivered in-app; users cannot opt out of them. Only email delivery of
  // admin messages is user-controllable (see emailAdminMessage).
  emailPostComment  Boolean  @default(false)
  emailCommentReply Boolean  @default(false)
  emailMention      Boolean  @default(false)
  emailAdminMessage Boolean  @default(true)
  emailOrderStatus  Boolean  @default(true)
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preferences")
}
```

Defaults:
- Admin messages and order status default to email-on (high importance, matches existing order-email behavior).
- Community interactions default to in-app-only (email-off) to avoid inbox noise.
- Admin messages have **no in-app opt-out** by design — admins must be able to reach users with account-critical notices.
- Missing rows are treated as defaults — no backfill needed for existing users.

### 3.3 User relation

```prisma
model User {
  // ...
  notifications          Notification[]
  notificationPreference NotificationPreference?
}
```

### 3.4 Notification type constants

```ts
// src/lib/notification-types.ts
export const NotificationType = {
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  MENTION: 'mention',
  ADMIN_MESSAGE: 'admin_message',
  ORDER_STATUS: 'order_status',
} as const
export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType]
```

Stays string-compatible with existing `'order_status'` literals.

## 4. Feature-level design

### 4.1 Comment / reply / mention notifications (boards plugin)

Trigger location: `src/plugins/boards/api/posts/[id]/comments/route.ts` — the comment-create `POST` handler.

Recipient resolution (pseudocode):

```ts
const post = await prisma.post.findUnique({ ... })
const recipients = new Map<number, 'post_comment' | 'comment_reply'>()

if (parentId) {
  const parent = await prisma.comment.findUnique({ where: { id: parentId } })
  if (parent && parent.authorId !== session.id) recipients.set(parent.authorId, 'comment_reply')
  if (post.authorId !== session.id && !recipients.has(post.authorId)) {
    recipients.set(post.authorId, 'post_comment')
  }
} else {
  if (post.authorId !== session.id) recipients.set(post.authorId, 'post_comment')
}

for (const [uid, kind] of recipients) {
  if (kind === 'comment_reply') await createCommentReplyNotification({ userId: uid, ... })
  else                           await createPostCommentNotification({ userId: uid, ... })
}

// Mentions (after the above, so we can dedup against the recipients map)
const mentioned = parseMentions(comment.content).slice(0, 10) // spam cap
const users = await resolveMentions(mentioned)
for (const u of users) {
  if (u.id === session.id) continue
  if (recipients.has(u.id)) continue
  await createMentionNotification({ userId: u.id, ... })
}
```

Dedup rule: one comment produces at most one notification per user. Mentions are suppressed when the user is already getting a comment/reply notification for the same comment.

Mention parser regex: `/@([a-zA-Z0-9_가-힣]{2,20})/g`. Unknown nicknames are silently dropped. Per-comment mention cap: 10.

### 4.2 Notification preferences page

- Path: `/mypage/settings/notifications`
- Layout: `MyPageLayout` (existing).
- UI: table of notification types × two switches (in-app / email). Save on change (optimistic) with toast.
- API: `GET /api/notifications/preferences` returns the row or defaults; `PUT /api/notifications/preferences` upserts.

### 4.3 `/mypage/notifications` polish

- **Filter tabs**: All / Unread / Comments / Replies / Mentions / Admin / Orders.
- **Delete**: per-item X button (hover/click), plus "Delete all" button. Uses existing soft-delete API.
- **Pagination**: cursor-based "Load more" button (not infinite scroll — simpler, more predictable).
- **Relative time**: `date-fns` `formatDistanceToNow` with locale. Dependency already present.
- **Type icons**: `lucide-react` — `MessageSquare` (post comment), `Reply` (reply), `AtSign` (mention), `Megaphone` (admin), `Package` (order).

### 4.4 Admin free-form notification

- API: `POST /api/admin/notifications/send`
- Body:
  ```ts
  {
    userId: number,
    title: string,    // 1..100
    message: string,  // 1..2000
    link?: string,    // must start with '/'
    sendEmail?: boolean
  }
  ```
- AuthZ: `session.role in ['admin', 'manager']`.
- Rate limit: 60/minute per session (in-memory counter, Phase-1 good-enough).
- Behavior:
  1. `createNotification({ type: 'admin_message', ... })` — **always written**, bypassing `shouldNotify` since admin messages have no in-app opt-out.
  2. If `sendEmail` and `emailAdminMessage` preference is on → `sendAdminMessageEmail(to, title, message, link)`.
- UI: `<SendNotificationDialog userId={...} prefillLink?={...}>` (shadcn Dialog + form + zod).
- Mount points:
  - `/admin/users/[id]` — "알림 보내기" / "Send notification" button.
  - `/admin/shop/orders/[orderNo]` — "고객에게 알림 보내기" with order link prefilled.

### 4.5 Core API semantics (for plugin authors)

Every `create*Notification` helper:

1. Calls `shouldNotify(userId, type)`; if false → return `null` (no DB write).
2. Inserts the row.
3. If the per-type email flag is on → calls the relevant email sender (fire-and-forget, logged on error).

Consumers never need to know about preferences. Plugins import from `@/lib/notification`.

## 5. Cross-cutting concerns

### 5.1 Testing

- **Unit (TDD)**: `mentions.ts` parser — empty, ascii, hangul, mixed, boundary length, duplicates; `shouldNotify` — default, enabled, disabled, missing row.
- **Integration**: `/api/admin/notifications/send` — authz, payload validation, email flag, unknown userId; `/api/notifications/preferences` — defaults, upsert round-trip; comments route — counts of notifications for post/reply/mention cases including self-skip and dedup.
- **Manual E2E checklist**: author / commenter / replier / mentioned user scenarios; preference toggles taking effect; admin send from both user-admin and order-admin; notifications page filters / delete / load-more / relative time.

### 5.2 Migration

- Schema change: add `notification_preferences` table only.
- Command: `npx prisma migrate dev --name add_notification_preferences` (dev), `npm run db:migrate` (prod).
- No data backfill — absent rows behave as defaults.
- Rollback: DROP table; app keeps working since helpers tolerate missing rows.

### 5.3 Implementation order (steps for the plan)

1. Prisma schema + `NotificationType` constants.
2. `src/lib/mentions.ts` (TDD).
3. `src/lib/notification.ts` extension + `shouldNotify` (TDD for `shouldNotify`).
4. `/api/notifications/preferences` (GET/PUT).
5. `/mypage/settings/notifications` page.
6. `/mypage/notifications` page refactor (filters, delete, load-more, relative time).
7. Boards-plugin comment hook (post comment, reply, mention).
8. `/api/admin/notifications/send` + email helper.
9. `SendNotificationDialog` component.
10. Mount dialog on user-admin detail and shop order-admin detail.
11. i18n keys (ko/en).
12. Manual E2E pass.

Each step is an independent commit. No feature flag — backward compatible throughout.

### 5.4 i18n keys (ko/en)

- `mypage.notifications.filter.{all,unread,postComment,commentReply,mention,admin,order}`
- `mypage.notifications.{deleteAll,deleteOne,loadMore}`
- `mypage.settings.notifications.{title,inApp,email}`
- `mypage.settings.notifications.types.{postComment,commentReply,mention,orderStatus}`
- `mypage.settings.notifications.emailTypes.{postComment,commentReply,mention,adminMessage,orderStatus}`
- `mypage.settings.notifications.adminMessageNote` (explains in-app delivery is mandatory)
- `admin.notifications.send.{button,title,message,link,sendEmail,success,failure}`
- `notification.type.{postComment,commentReply,mention,adminMessage,orderStatus}`

### 5.5 Performance / security

- Existing `Notification` indexes (`userId`, `userId+isRead`, `createdAt`) are sufficient. `NotificationPreference.userId @unique` provides its index.
- Multi-recipient fanout uses `Promise.all`; not a DB transaction (partial failure acceptable — alternative is blocking the commenter on unrelated writes).
- Mention spam cap: max 10 mentions per comment.
- Admin send rate limit: 60/min in-memory, keyed by session id.
- XSS: notification `title` / `message` are rendered through React (auto-escaped). Links must start with `/` (internal only) — enforced server-side.
- Link safety: `rel="noopener noreferrer"` on any anchor rendered.

## 6. Future work (explicitly deferred)

- Threaded 1:1 DM (`messaging` plugin): schema, polling-based message thread UI, unread per-thread.
- Mutual block system: coupled with DM; must enforce that admins cannot be blocked.
- Bulk admin send (multi-user selection).
- Richer mention autocomplete UI (currently free-text `@nickname`).
- Web Push / mobile push.

---

## (한국어) 설계 요약

### 목표

코어 알림 시스템을 "주문 전용"에서 **커뮤니티 상호작용(댓글·답글·멘션)과 관리자-유저 단건 알림**까지 커버하는 범용 기반으로 확장한다. 플러그인이 코어 함수 호출만으로 자기 알림을 쏠 수 있도록 **코어 API 계약**을 확립한다.

### 이번 범위 (Phase 1)

- 댓글 / 대댓글 / 멘션 알림 (boards 플러그인에서 코어 함수 호출)
- 유저별 알림 수신 설정 (타입별 인앱 on/off + 이메일 on/off)
- `/mypage/notifications` 페이지 완성 (삭제 / 필터 / "더 보기" / 상대시간)
- `/mypage/settings/notifications` (신규)
- **관리자 → 특정 유저 자유 알림** (유저 상세 및 주문 상세에서 버튼, 이메일 동시 발송 옵션)
- 코어 notification API 표면 정리

### 범위 제외

- 쪽지(스레드형 1:1 DM) — 필요 시 `messaging` 플러그인으로 별도
- 차단 시스템 — 쪽지 전제이므로 함께 연기
- 관리자 전체 공지 (broadcast) — 드롭
- 실시간 푸시(SSE/WebSocket) — 기존 60초 폴링 유지 (일반 호스팅 호환)
- 여러 유저 일괄 발송 — 추후 쉬운 확장

### 아키텍처 원칙

- `prisma/schema.prisma`는 **자동 생성 산출물**. `prisma/schema.base.prisma`만 편집.
- 플러그인은 코어 헬퍼를 호출하기만 한다. 알림 저장소는 코어가 소유.
- 헬퍼 내부에서 **사용자 수신 설정**을 확인해 조용히 skip → 플러그인은 설정을 몰라도 됨.
- 폴링 유지, 서버 푸시 인프라 의존성 없음.

### 데이터 모델

- 기존 `Notification` 테이블 **변경 없음**.
- 신규 `NotificationPreference` 테이블 1개 추가 (타입별 인앱/이메일 boolean).
- 기존 유저 마이그레이션 불필요 (행 없으면 기본값).

### 주요 기능

- **댓글 훅**: 원글·대댓글·멘션에 대한 알림을 한 댓글당 유저당 1건으로 dedup (멘션 > 답글 > 원글 우선). 멘션은 댓글당 최대 10명.
- **알림 설정 페이지**: 타입별 2열 스위치 테이블. 변경 즉시 저장.
- **알림 페이지**: 필터 탭 / 개별·전체 삭제 / "더 보기" 페이지네이션 / `date-fns` 상대시간.
- **관리자 자유 알림**: `POST /api/admin/notifications/send` (userId/title/message/link?/sendEmail?). 관리자·매니저 권한, 분당 60건 제한, 링크는 `/` 시작 내부 경로만 허용. **인앱 수신은 강제** (계정·정책 중요 공지 누락 방지), 이메일만 유저가 끌 수 있음.

### 구현 순서

1. Prisma 스키마 + `NotificationType` 상수
2. `src/lib/mentions.ts` (TDD)
3. `src/lib/notification.ts` 확장 + `shouldNotify` (TDD)
4. `/api/notifications/preferences` (GET/PUT)
5. `/mypage/settings/notifications` 페이지
6. `/mypage/notifications` 리팩터
7. boards 플러그인 댓글 훅
8. `/api/admin/notifications/send` + 이메일 헬퍼
9. `SendNotificationDialog` 컴포넌트
10. 유저 상세 / 주문 상세 페이지에 다이얼로그 연결
11. i18n(ko/en) 키 추가
12. 수동 E2E

각 단계는 독립 커밋. 기능 플래그 불필요.

### 마이그레이션

- 신규 테이블 1개만 추가
- 기존 데이터 영향 0, 롤백은 테이블 DROP
- 앱은 설정 행 없음을 기본값으로 안전하게 처리

### 성능·보안 요약

- 기존 인덱스로 충분. `NotificationPreference.userId @unique`.
- 멘션 스팸 캡 10, 관리자 발송 rate limit 60/min.
- XSS: React 기본 이스케이프 + 링크는 내부 경로만.
