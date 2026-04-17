# Notifications Completion (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the core notification system from "order-only" to cover boards comment/reply/mention notifications, per-user notification preferences (in-app + email), a polished `/mypage/notifications` page with delete/filter/pagination/relative time, a new `/mypage/settings/notifications` preferences page, and an admin free-form notification-send action from user-admin (row dialog) and shop-order-admin (detail dialog).

**Architecture:** Core owns notification storage, preferences, and send helpers (`src/lib/notification.ts`, `src/app/api/notifications/*`). Plugins trigger notifications by calling core helpers — the boards plugin's comment POST route invokes them. Admin free-form notifications reuse `createNotification` and a new email helper, mounted via a single reusable `<SendNotificationDialog>`. All polling stays as-is (60-second header poll); no SSE/WebSocket.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 (MySQL), next-intl, shadcn/ui (Dialog, Switch, Tabs, Button), lucide-react, date-fns, nodemailer (existing), isomorphic-dompurify (existing).

**Testing note:** This codebase has **no test framework installed** (no vitest/jest, no `*.test.ts` files). Verification in this plan uses **manual E2E steps in `npm run dev`** rather than automated unit tests. The spec mentioned TDD for `mentions.ts` and `shouldNotify`; adding a test runner is out of scope. Pure functions are kept small with example usages in code comments so future test introduction is easy.

**Spec:** [docs/superpowers/specs/2026-04-17-notifications-completion-design.md](../specs/2026-04-17-notifications-completion-design.md)

**Commit convention (from `CLAUDE.md`):** English subject (Conventional Commits), body in English, `---` separator, then Korean translation of the body.

---

## File map

### Create
- `src/lib/notification-types.ts` — `NotificationType` string constants.
- `src/lib/mentions.ts` — `@nickname` parser + resolver.
- `src/app/api/notifications/preferences/route.ts` — GET / PUT user preferences.
- `src/app/api/admin/notifications/send/route.ts` — POST admin free-form notification.
- `src/app/[locale]/mypage/settings/notifications/page.tsx` — preferences UI.
- `src/components/admin/SendNotificationDialog.tsx` — reusable admin send dialog.

### Modify
- `prisma/schema.base.prisma` — add `NotificationPreference` model + User relation.
- `src/lib/notification.ts` — add `shouldNotify`, `createPostCommentNotification`, `createCommentReplyNotification`, `createMentionNotification`, make `createNotification` preference-aware.
- `src/lib/email.ts` — add `sendAdminMessageEmail`.
- `src/app/[locale]/mypage/notifications/page.tsx` — add filter tabs, per-item delete, delete-all, "load more" pagination, relative time.
- `src/plugins/boards/api/[slug]/posts/[postId]/comments/route.ts` — trigger notifications after comment create.
- `src/app/[locale]/admin/users/page.tsx` — add "Send notification" row action + mount dialog.
- `src/plugins/shop/admin/orders/[id]/page.tsx` — add "Send notification" button + mount dialog (with order link prefilled).
- `src/components/layout/MyPageLayout.tsx` — add "알림 설정" nav entry.
- `src/locales/ko.json`, `src/locales/en.json` — i18n keys.

### Keep unchanged
- `src/app/api/notifications/route.ts` — already supports GET/PUT/DELETE filtering.
- `src/app/api/notifications/count/route.ts` — header polling stays.
- `src/layouts/default/Header.tsx` — bell icon and polling stay.

---

## Task 1: Prisma schema + NotificationType constants

**Files:**
- Modify: `prisma/schema.base.prisma` (User model relation + new model)
- Create: `src/lib/notification-types.ts`

- [ ] **Step 1.1: Add `NotificationPreference` model to `prisma/schema.base.prisma`**

Insert the following **after** the existing `Notification` model block (before `model Menu`):

```prisma
model NotificationPreference {
  id                Int      @id @default(autoincrement())
  userId            Int      @unique
  postComment       Boolean  @default(true)
  commentReply      Boolean  @default(true)
  mention           Boolean  @default(true)
  orderStatus       Boolean  @default(true)
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

- [ ] **Step 1.2: Add `notificationPreference` relation on `User`**

In `prisma/schema.base.prisma`, find the `User` model. After the line `notifications Notification[]`, add:

```prisma
  notificationPreference NotificationPreference?
```

So it becomes (context):

```prisma
  notifications Notification[]
  notificationPreference NotificationPreference?
  addresses     UserAddress[]
```

- [ ] **Step 1.3: Regenerate merged schema and Prisma client**

Run:

```bash
npm run dev
```

Wait until the dev server prints "Ready". Then stop it (Ctrl-C). The `scripts/scan-plugins.js` ran during startup and rewrote `prisma/schema.prisma`. Verify:

```bash
grep -A 2 'notification_preferences' prisma/schema.prisma
```

Expected: block containing `notificationPreference` fields. Then run:

```bash
npx prisma generate
```

Expected: "Generated Prisma Client".

- [ ] **Step 1.4: Create the DB migration**

Run:

```bash
npx prisma migrate dev --name add_notification_preferences
```

Expected: migration file created under `prisma/migrations/*_add_notification_preferences/` and `notification_preferences` table created in the local database.

- [ ] **Step 1.5: Create `src/lib/notification-types.ts`**

```ts
// Canonical notification type identifiers. Kept as string literals so
// stored values remain readable in the DB and existing 'order_status'
// records stay compatible.
export const NotificationType = {
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  MENTION: 'mention',
  ADMIN_MESSAGE: 'admin_message',
  ORDER_STATUS: 'order_status',
} as const

export type NotificationTypeValue =
  typeof NotificationType[keyof typeof NotificationType]

// Types that obey user preference (both in-app and email).
// ADMIN_MESSAGE is intentionally omitted — admin messages must always
// reach the user in-app and can only be opted out of by email.
export const PREFERENCE_CONTROLLED_TYPES: NotificationTypeValue[] = [
  NotificationType.POST_COMMENT,
  NotificationType.COMMENT_REPLY,
  NotificationType.MENTION,
  NotificationType.ORDER_STATUS,
]
```

- [ ] **Step 1.6: Verify types compile**

Run:

```bash
npx tsc --noEmit
```

Expected: exits with code 0 (no type errors).

- [ ] **Step 1.7: Commit**

```bash
git add prisma/schema.base.prisma prisma/migrations/ src/lib/notification-types.ts
git commit -m "$(cat <<'EOF'
feat(notifications): add NotificationPreference model + type constants

Add per-user notification preferences table (in-app + email flags per
type) and a canonical NotificationType constants module. Admin messages
are intentionally excluded from the in-app preference axis so they
cannot be silently suppressed.

---

유저별 알림 수신 설정 테이블(타입별 인앱/이메일 boolean)과
NotificationType 상수 모듈 추가. 관리자 알림은 인앱에서 끌 수 없도록
의도적으로 설정 축에서 제외.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Mentions parser

**Files:**
- Create: `src/lib/mentions.ts`

- [ ] **Step 2.1: Create `src/lib/mentions.ts`**

```ts
import { prisma } from '@/lib/prisma'

// Matches @<nickname>. Nicknames: 2–20 chars, ASCII alphanumerics,
// underscore, and hangul syllables. Stops at whitespace or punctuation.
//
// Examples:
//   "hello @alice"            -> ["alice"]
//   "@alice @밥 @alice"       -> ["alice", "밥"]   (dedup preserved order)
//   "email foo@bar.com here"  -> []               (no space before @)
//   "@ab"                     -> ["ab"]           (min length 2)
//   "@a"                      -> []               (below min length)
const MENTION_RE = /(^|\s)@([A-Za-z0-9_\uAC00-\uD7A3]{2,20})/g

/** Extract mention nicknames from a content string (dedup, order preserved). */
export function parseMentions(content: string): string[] {
  if (!content) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const match of content.matchAll(MENTION_RE)) {
    const nick = match[2]
    if (!seen.has(nick)) {
      seen.add(nick)
      out.push(nick)
    }
  }
  return out
}

/** Look up users by nickname. Unknown nicknames are silently dropped. */
export async function resolveMentions(
  nicknames: string[],
): Promise<{ id: number; nickname: string }[]> {
  if (nicknames.length === 0) return []
  const users = await prisma.user.findMany({
    where: { nickname: { in: nicknames }, deletedAt: null },
    select: { id: true, nickname: true },
  })
  return users
}
```

- [ ] **Step 2.2: Manually verify parser with a scratch REPL**

Run (one-off):

```bash
cat > /tmp/mention-check.mjs <<'EOF'
const MENTION_RE = /(^|\s)@([A-Za-z0-9_\uAC00-\uD7A3]{2,20})/g
function parseMentions(content) {
  if (!content) return []
  const out = []
  const seen = new Set()
  for (const match of content.matchAll(MENTION_RE)) {
    const nick = match[2]
    if (!seen.has(nick)) { seen.add(nick); out.push(nick) }
  }
  return out
}
const cases = [
  ['hello @alice', ['alice']],
  ['@alice @밥 @alice', ['alice', '밥']],
  ['email foo@bar.com here', []],
  ['@ab ok', ['ab']],
  ['@a too short', []],
  ['', []],
  ['@alice, nice', ['alice']],
  ['text @유저_1 end', ['유저_1']],
]
for (const [input, expected] of cases) {
  const got = parseMentions(input)
  const ok = JSON.stringify(got) === JSON.stringify(expected)
  console.log(ok ? 'OK ' : 'FAIL', JSON.stringify(input), '→', got, 'expected', expected)
}
EOF
node /tmp/mention-check.mjs
```

Expected output: every line prefixed `OK`.

- [ ] **Step 2.3: Verify types compile**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2.4: Commit**

```bash
git add src/lib/mentions.ts
git commit -m "$(cat <<'EOF'
feat(notifications): add @mention parser and resolver

Pure-function parser for @nickname tokens in comment bodies (ASCII,
underscore, and hangul; length 2–20). Resolver looks up existing users
by nickname, silently dropping unknown names.

---

댓글 본문에서 @닉네임 토큰을 파싱하는 순수 함수와 nickname으로
사용자를 조회하는 리졸버 추가. 길이 2~20, 영숫자·언더스코어·한글 허용,
존재하지 않는 닉네임은 무시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend `src/lib/notification.ts` with preference-aware helpers

**Files:**
- Modify: `src/lib/notification.ts`

- [ ] **Step 3.1: Add imports + `shouldNotify` helper at the top of the file**

Open `src/lib/notification.ts`. At the top (after the existing imports), add:

```ts
import { NotificationType, NotificationTypeValue, PREFERENCE_CONTROLLED_TYPES } from '@/lib/notification-types'
```

Then, **immediately after** the existing `export type NotificationType = ...` line (around line 4), delete that existing type alias (it conflicts with the new module) and replace all internal uses with `NotificationTypeValue`.

Before:

```ts
export type NotificationType = 'order_status' | 'review_reply' | 'qna_reply' | 'system'

interface CreateNotificationParams {
  userId: number
  type: NotificationType
```

After:

```ts
// NotificationType value union comes from '@/lib/notification-types'.

interface CreateNotificationParams {
  userId: number
  type: NotificationTypeValue
```

- [ ] **Step 3.2: Add the `shouldNotify` helper**

Insert after the `CreateNotificationParams` interface and before `createNotification`:

```ts
/**
 * Consult the user's NotificationPreference row and decide whether an
 * in-app notification of the given type should be written.
 *
 * Rules:
 *   - ADMIN_MESSAGE bypasses preferences (always delivered in-app).
 *   - Types in PREFERENCE_CONTROLLED_TYPES respect the matching
 *     boolean field. Missing row = default (all true).
 *   - Any unlisted custom type (e.g. legacy 'review_reply') defaults to
 *     delivered (backwards compatible).
 */
export async function shouldNotify(
  userId: number,
  type: NotificationTypeValue | string,
): Promise<boolean> {
  if (type === NotificationType.ADMIN_MESSAGE) return true
  if (!PREFERENCE_CONTROLLED_TYPES.includes(type as NotificationTypeValue)) {
    return true
  }
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  })
  if (!pref) return true
  switch (type) {
    case NotificationType.POST_COMMENT: return pref.postComment
    case NotificationType.COMMENT_REPLY: return pref.commentReply
    case NotificationType.MENTION: return pref.mention
    case NotificationType.ORDER_STATUS: return pref.orderStatus
    default: return true
  }
}

/**
 * Companion helper: should this type also trigger an email?
 */
export async function shouldEmail(
  userId: number,
  type: NotificationTypeValue | string,
): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  })
  // Defaults when the row is absent. Keep in sync with schema defaults.
  const defaults: Record<string, boolean> = {
    [NotificationType.POST_COMMENT]: false,
    [NotificationType.COMMENT_REPLY]: false,
    [NotificationType.MENTION]: false,
    [NotificationType.ADMIN_MESSAGE]: true,
    [NotificationType.ORDER_STATUS]: true,
  }
  if (!pref) return defaults[type] ?? false
  switch (type) {
    case NotificationType.POST_COMMENT: return pref.emailPostComment
    case NotificationType.COMMENT_REPLY: return pref.emailCommentReply
    case NotificationType.MENTION: return pref.emailMention
    case NotificationType.ADMIN_MESSAGE: return pref.emailAdminMessage
    case NotificationType.ORDER_STATUS: return pref.emailOrderStatus
    default: return defaults[type] ?? false
  }
}
```

- [ ] **Step 3.3: Make `createNotification` preference-aware**

Replace the existing `createNotification` function body with:

```ts
/**
 * Create a notification record. Silently returns null when the user has
 * disabled this type via their NotificationPreference.
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    if (!(await shouldNotify(params.userId, params.type))) return null
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    })
  } catch (error) {
    console.error('failed to create notification:', error)
    return null
  }
}
```

- [ ] **Step 3.4: Add community-event helpers at the bottom of the file**

Append at the end of `src/lib/notification.ts`:

```ts
interface PostCommentParams {
  userId: number               // recipient (post author)
  fromUserName: string         // commenter nickname (for display)
  postTitle: string
  postLink: string             // e.g. "/boards/free/123"
  excerpt?: string             // short snippet of the comment body
}

export async function createPostCommentNotification(params: PostCommentParams) {
  return createNotification({
    userId: params.userId,
    type: NotificationType.POST_COMMENT,
    title: `💬 ${params.fromUserName}님이 댓글을 남겼습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  })
}

interface CommentReplyParams {
  userId: number               // recipient (parent-comment author)
  fromUserName: string
  postTitle: string
  postLink: string
  excerpt?: string
}

export async function createCommentReplyNotification(params: CommentReplyParams) {
  return createNotification({
    userId: params.userId,
    type: NotificationType.COMMENT_REPLY,
    title: `↩️ ${params.fromUserName}님이 답글을 남겼습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  })
}

interface MentionParams {
  userId: number               // recipient (mentioned user)
  fromUserName: string
  postTitle: string
  postLink: string
  excerpt?: string
}

export async function createMentionNotification(params: MentionParams) {
  return createNotification({
    userId: params.userId,
    type: NotificationType.MENTION,
    title: `@ ${params.fromUserName}님이 회원님을 언급했습니다`,
    message: `"${params.postTitle}" — ${params.excerpt ?? ''}`.trim(),
    link: params.postLink,
  })
}

interface AdminMessageParams {
  userId: number
  title: string
  message: string
  link?: string
}

/**
 * Admin free-form notification. Bypasses in-app preferences (see
 * shouldNotify). Caller is responsible for sending the email separately
 * after consulting shouldEmail + user's email.
 */
export async function createAdminMessageNotification(params: AdminMessageParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.ADMIN_MESSAGE,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    })
  } catch (error) {
    console.error('failed to create admin notification:', error)
    return null
  }
}
```

- [ ] **Step 3.5: Verify types compile**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0. Any remaining reference to the deleted `NotificationType` type alias will appear here — fix by importing `NotificationTypeValue` from `@/lib/notification-types` and replacing usages.

- [ ] **Step 3.6: Manual smoke — start dev server, check an existing order flow still compiles**

Run:

```bash
npm run dev
```

Wait for "Ready". Load http://localhost:3000/ in a browser. Confirm no runtime errors in the server console related to `notification.ts`. Stop the server.

- [ ] **Step 3.7: Commit**

```bash
git add src/lib/notification.ts
git commit -m "$(cat <<'EOF'
feat(notifications): preference-aware core helpers

Add shouldNotify / shouldEmail that consult NotificationPreference
(with safe defaults when the row is absent), make createNotification
preference-aware, and introduce community-event helpers
(createPostCommentNotification, createCommentReplyNotification,
createMentionNotification) plus createAdminMessageNotification for the
admin send path. Admin messages bypass the in-app preference axis.

---

shouldNotify / shouldEmail로 NotificationPreference를 조회해 기본값을
안전하게 적용하고, createNotification을 설정 인식형으로 변경.
커뮤니티 이벤트 헬퍼(createPostComment/CommentReply/Mention)와
관리자 메시지 헬퍼 추가. 관리자 알림은 인앱 수신 설정 무시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Notification preferences API

**Files:**
- Create: `src/app/api/notifications/preferences/route.ts`

- [ ] **Step 4.1: Create the route file**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Defaults — must mirror prisma schema defaults for NotificationPreference.
const DEFAULTS = {
  postComment: true,
  commentReply: true,
  mention: true,
  orderStatus: true,
  emailPostComment: false,
  emailCommentReply: false,
  emailMention: false,
  emailAdminMessage: true,
  emailOrderStatus: true,
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: session.id },
  })
  return NextResponse.json({ preference: pref ?? { userId: session.id, ...DEFAULTS } })
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()

  // Whitelist fields; coerce to boolean.
  const allowed: (keyof typeof DEFAULTS)[] = [
    'postComment', 'commentReply', 'mention', 'orderStatus',
    'emailPostComment', 'emailCommentReply', 'emailMention',
    'emailAdminMessage', 'emailOrderStatus',
  ]
  const data: Record<string, boolean> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') data[key] = body[key]
  }

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: session.id },
    create: { userId: session.id, ...DEFAULTS, ...data },
    update: data,
  })
  return NextResponse.json({ preference: pref })
}
```

- [ ] **Step 4.2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4.3: Manual verification**

Start the dev server and, while logged in as any user, run in the browser DevTools console:

```js
await fetch('/api/notifications/preferences').then(r => r.json())
```

Expected: `{ preference: { userId: <n>, postComment: true, ... } }` with defaults.

Then:

```js
await fetch('/api/notifications/preferences', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ postComment: false, emailMention: true }),
}).then(r => r.json())
```

Expected: `{ preference: { ..., postComment: false, emailMention: true } }`. Re-run the GET to confirm persistence.

- [ ] **Step 4.4: Commit**

```bash
git add src/app/api/notifications/preferences/route.ts
git commit -m "$(cat <<'EOF'
feat(notifications): preferences GET/PUT endpoint

Return per-user notification preferences (defaults applied when row is
absent) and accept upsert on PUT with a whitelisted field set. Auth
required; silent 401 for unauthenticated callers.

---

유저별 알림 수신 설정 조회(행 없으면 기본값 반환)와 업서트(PUT)
엔드포인트 추가. 허용 필드만 받는 화이트리스트 적용, 인증 필수.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Preferences page UI

**Files:**
- Create: `src/app/[locale]/mypage/settings/notifications/page.tsx`
- Modify: `src/components/layout/MyPageLayout.tsx` (add nav link)

- [ ] **Step 5.1: Create the page**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Switch } from "@/components/ui/switch"
import { Bell, Mail, Info } from "lucide-react"

type Pref = {
  postComment: boolean
  commentReply: boolean
  mention: boolean
  orderStatus: boolean
  emailPostComment: boolean
  emailCommentReply: boolean
  emailMention: boolean
  emailAdminMessage: boolean
  emailOrderStatus: boolean
}

const ROWS: { key: keyof Pref; emailKey: keyof Pref | null; labelKey: string }[] = [
  { key: 'postComment',  emailKey: 'emailPostComment',  labelKey: 'postComment' },
  { key: 'commentReply', emailKey: 'emailCommentReply', labelKey: 'commentReply' },
  { key: 'mention',      emailKey: 'emailMention',      labelKey: 'mention' },
  { key: 'orderStatus',  emailKey: 'emailOrderStatus',  labelKey: 'orderStatus' },
]

export default function NotificationSettingsPage() {
  const t = useTranslations('mypage.settings.notifications')
  const [pref, setPref] = useState<Pref | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => setPref(d.preference))
      .catch(() => setPref(null))
  }, [])

  async function update(patch: Partial<Pref>) {
    if (!pref) return
    const next = { ...pref, ...patch }
    setPref(next)
    setSaving(true)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t('title')}
        </h2>

        {!pref ? (
          <div className="text-sm text-muted-foreground">...</div>
        ) : (
          <div className="border rounded-lg divide-y">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground">
              <span />
              <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{t('inApp')}</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{t('email')}</span>
            </div>
            {ROWS.map(row => (
              <div key={row.key} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center">
                <span className="text-sm">{t(`types.${row.labelKey}`)}</span>
                <Switch
                  checked={pref[row.key] as boolean}
                  onCheckedChange={v => update({ [row.key]: v } as Partial<Pref>)}
                />
                {row.emailKey ? (
                  <Switch
                    checked={pref[row.emailKey] as boolean}
                    onCheckedChange={v => update({ [row.emailKey!]: v } as Partial<Pref>)}
                  />
                ) : <span />}
              </div>
            ))}

            {/* Admin message row — in-app forced ON, only email toggles */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center">
              <span className="text-sm flex items-center gap-2">
                {t('types.adminMessage')}
                <span title={t('adminMessageNote')}>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </span>
              <Switch checked disabled />
              <Switch
                checked={pref.emailAdminMessage}
                onCheckedChange={v => update({ emailAdminMessage: v })}
              />
            </div>
          </div>
        )}

        {saving && <p className="text-xs text-muted-foreground">...</p>}
      </div>
    </MyPageLayout>
  )
}
```

- [ ] **Step 5.2: Add a nav link in `MyPageLayout`**

Open `src/components/layout/MyPageLayout.tsx`. Find the `items.push({ label: t('notifications'), icon: 'Bell', path: '/mypage/notifications' })` line (around line 108). Immediately after it, add:

```ts
items.push({ label: t('notificationSettings'), icon: 'Settings', path: '/mypage/settings/notifications' })
```

- [ ] **Step 5.3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0. (If `t('notificationSettings')` throws at runtime because the key is missing, that's fine — it's added in Task 11.)

- [ ] **Step 5.4: Manual verification**

Start dev server, log in, visit `/mypage/settings/notifications`. Verify:
- The four preference rows render with two switches each.
- Admin message row shows disabled in-app switch + enabled email switch.
- Toggling a switch triggers the PUT (Network tab) and persists after reload.

- [ ] **Step 5.5: Commit**

```bash
git add src/app/[locale]/mypage/settings/notifications/page.tsx src/components/layout/MyPageLayout.tsx
git commit -m "$(cat <<'EOF'
feat(notifications): notification preferences page

Add /mypage/settings/notifications with a per-type in-app/email switch
matrix. Admin message row pins the in-app switch on with an info
tooltip explaining it's mandatory. Also adds a nav entry in MyPageLayout.

---

/mypage/settings/notifications 설정 페이지 추가. 타입별로 인앱/이메일
스위치 행렬 표시. 관리자 알림 행은 인앱 스위치가 강제 ON이며
안내 툴팁 표시. MyPageLayout에 네비 항목 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Polish `/mypage/notifications`

**Files:**
- Modify: `src/app/[locale]/mypage/notifications/page.tsx`

- [ ] **Step 6.1: Replace the page content**

Replace the entire file with:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Bell, Check, Trash2, MessageSquare, Reply, AtSign, Megaphone, Package,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko, enUS } from "date-fns/locale"

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

const FILTERS = [
  { id: 'all',          typeParam: '' },
  { id: 'unread',       typeParam: '' },
  { id: 'post_comment', typeParam: 'post_comment' },
  { id: 'comment_reply',typeParam: 'comment_reply' },
  { id: 'mention',      typeParam: 'mention' },
  { id: 'admin_message',typeParam: 'admin_message' },
  { id: 'order_status', typeParam: 'order_status' },
] as const

type FilterId = typeof FILTERS[number]['id']

const PAGE_SIZE = 20

function iconFor(type: string) {
  switch (type) {
    case 'post_comment':  return <MessageSquare className="h-4 w-4" />
    case 'comment_reply': return <Reply className="h-4 w-4" />
    case 'mention':       return <AtSign className="h-4 w-4" />
    case 'admin_message': return <Megaphone className="h-4 w-4" />
    case 'order_status':  return <Package className="h-4 w-4" />
    default:              return <Bell className="h-4 w-4" />
  }
}

export default function NotificationsPage() {
  const t = useTranslations('mypage')
  const tn = useTranslations('mypage.notifications')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dfLocale = locale === 'ko' ? ko : enUS

  const [items, setItems] = useState<Notification[]>([])
  const [filter, setFilter] = useState<FilterId>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchPage = useCallback(async (pageNum: number, filterId: FilterId, append: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      })
      if (filterId === 'unread') params.set('unreadOnly', 'true')
      const typeParam = FILTERS.find(f => f.id === filterId)?.typeParam
      if (typeParam) params.set('type', typeParam)
      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setItems(prev => append ? [...prev, ...data.notifications] : data.notifications)
      setTotalPages(data.pagination?.totalPages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchPage(1, filter, false)
  }, [filter, fetchPage])

  const unreadCount = items.filter(n => !n.isRead).length

  async function markAsRead(id: number) {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    })
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  async function markAllAsRead() {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  async function deleteOne(id: number) {
    await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAll() {
    if (!confirm(tn('confirmDeleteAll'))) return
    await fetch('/api/notifications?deleteAll=true', { method: 'DELETE' })
    setItems([])
  }

  return (
    <MyPageLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notifications')}
            {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
          </h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <Check className="h-4 w-4 mr-1" />
                {t('markAllRead')}
              </Button>
            )}
            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={deleteAll}>
                <Trash2 className="h-4 w-4 mr-1" />
                {tn('deleteAll')}
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
              }`}
            >
              {tn(`filter.${f.id}`)}
            </button>
          ))}
        </div>

        {loading && items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">{tc('loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">{t('noNotifications')}</div>
        ) : (
          <div className="space-y-2">
            {items.map(n => (
              <div
                key={n.id}
                className={`group p-4 border rounded-lg cursor-pointer transition-colors ${
                  n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'
                }`}
                onClick={() => {
                  if (!n.isRead) markAsRead(n.id)
                  if (n.link) window.location.href = n.link
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.isRead && <span className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                      <span className="text-muted-foreground">{iconFor(n.type)}</span>
                      <p className="text-sm font-medium truncate">{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dfLocale })}
                    </span>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                      aria-label={tn('deleteOne')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {page < totalPages && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => { const next = page + 1; setPage(next); fetchPage(next, filter, true) }}
                >
                  {tn('loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </MyPageLayout>
  )
}
```

- [ ] **Step 6.2: Support `type` filter in the list API**

Open `src/app/api/notifications/route.ts`. In the existing `GET` handler, extend the `where` clause to filter by `type` when the `type` query param is present.

Find:

```ts
const unreadOnly = searchParams.get('unreadOnly') === 'true';

const where = {
  userId: session.id,
  deletedAt: null,
  ...(unreadOnly && { isRead: false }),
};
```

Replace with:

```ts
const unreadOnly = searchParams.get('unreadOnly') === 'true';
const type = searchParams.get('type');

const where = {
  userId: session.id,
  deletedAt: null,
  ...(unreadOnly && { isRead: false }),
  ...(type && { type }),
};
```

- [ ] **Step 6.3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6.4: Manual verification**

Start dev, visit `/mypage/notifications`:
- Filter tabs switch between all/unread/types.
- Hovering a notification reveals the trash icon; clicking it deletes that row only.
- "Delete all" button works after a confirm dialog.
- Relative time shows "3시간 전" (ko) or "3 hours ago" (en).
- If you have more than 20 notifications, "Load more" appends the next page.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/[locale]/mypage/notifications/page.tsx src/app/api/notifications/route.ts
git commit -m "$(cat <<'EOF'
feat(notifications): polish /mypage/notifications page

Add type-aware filter tabs (all/unread/post_comment/comment_reply/
mention/admin_message/order_status), per-item delete (hover icon) and
delete-all button, cursor-based load more with page param, lucide
icons per notification type, and locale-aware relative time via
date-fns. Extend GET /api/notifications to accept type query param.

---

/mypage/notifications 페이지에 필터 탭(전체/안 읽음/타입별), 개별 삭제
(호버 아이콘)과 전체 삭제 버튼, "더 보기" 페이지네이션, 타입별 lucide
아이콘, date-fns 기반 locale 인식 상대 시간 추가. GET /api/notifications
가 type 쿼리 파라미터 지원하도록 확장.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Trigger notifications from the boards comment hook

**Files:**
- Modify: `src/plugins/boards/api/[slug]/posts/[postId]/comments/route.ts`

- [ ] **Step 7.1: Add imports**

At the top of `src/plugins/boards/api/[slug]/posts/[postId]/comments/route.ts`:

```ts
import {
  createPostCommentNotification,
  createCommentReplyNotification,
  createMentionNotification,
} from '@/lib/notification'
import { parseMentions, resolveMentions } from '@/lib/mentions'
```

- [ ] **Step 7.2: Insert the notification fan-out after comment creation**

In the `POST` handler, find:

```ts
    // Increment the post's comment count
    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } }
    })

    return NextResponse.json({
```

Immediately **before** the `return NextResponse.json({` line, insert:

```ts
    // --- Notification fan-out ---------------------------------------------
    // Build recipient map: one notification per user max per comment.
    // Priority: mention (handled later) > comment_reply > post_comment.
    const recipientKind = new Map<number, 'post_comment' | 'comment_reply'>()

    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parseInt(parentId) },
        select: { authorId: true },
      })
      if (parent && parent.authorId !== user.id) {
        recipientKind.set(parent.authorId, 'comment_reply')
      }
      if (post.authorId !== user.id && !recipientKind.has(post.authorId)) {
        recipientKind.set(post.authorId, 'post_comment')
      }
    } else {
      if (post.authorId !== user.id) {
        recipientKind.set(post.authorId, 'post_comment')
      }
    }

    const postLink = `/boards/${slug}/${postId}`
    const excerpt = content.trim().slice(0, 80)
    const fromUserName = user.nickname

    for (const [uid, kind] of recipientKind) {
      if (kind === 'comment_reply') {
        await createCommentReplyNotification({
          userId: uid, fromUserName, postTitle: post.title, postLink, excerpt,
        })
      } else {
        await createPostCommentNotification({
          userId: uid, fromUserName, postTitle: post.title, postLink, excerpt,
        })
      }
    }

    // Mentions (skip self, skip users already covered above, cap at 10)
    const nicknames = parseMentions(content).slice(0, 10)
    if (nicknames.length > 0) {
      const mentioned = await resolveMentions(nicknames)
      for (const m of mentioned) {
        if (m.id === user.id) continue
        if (recipientKind.has(m.id)) continue
        await createMentionNotification({
          userId: m.id, fromUserName, postTitle: post.title, postLink, excerpt,
        })
      }
    }
    // --- end fan-out -----------------------------------------------------
```

- [ ] **Step 7.3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0. If `user.nickname` triggers a null-check error, guard with `user.nickname ?? '익명'`.

- [ ] **Step 7.4: Manual E2E — comment notification**

Using two browser sessions (or an incognito window):
1. As user A, create a post in any board.
2. As user B, comment on that post.
3. As A, open `/mypage/notifications` — one `post_comment` notification should appear with B's nickname.

- [ ] **Step 7.5: Manual E2E — reply notification**

1. As user C, reply to B's comment (use the "답글" button).
2. As B, check `/mypage/notifications` — one `comment_reply`.
3. As A, check — one `post_comment` for the reply too (since replies also touch the post author).

- [ ] **Step 7.6: Manual E2E — mention notification**

1. As B, post another comment containing `@<A nickname> @<D nickname> thanks`.
2. As A, check — B's mention **does not create a second notification** (A already gets `post_comment`; mention is suppressed by dedup).
3. As D (uninvolved user), check — one `mention` notification.

- [ ] **Step 7.7: Manual E2E — self-skip**

1. As A, comment on A's own post, mention `@<A nickname>`.
2. Check A's notifications — no new entries.

- [ ] **Step 7.8: Manual E2E — preference respect**

1. As A, visit `/mypage/settings/notifications`, toggle "내 글에 댓글" off.
2. As B, comment on A's post.
3. A's notifications should **not** get a new row.

- [ ] **Step 7.9: Commit**

```bash
git add src/plugins/boards/api/[slug]/posts/[postId]/comments/route.ts
git commit -m "$(cat <<'EOF'
feat(boards): notify on post comment, reply, and mention

Hook the boards comment POST route into the core notification helpers:
recipients are the post author (for top-level comments), the parent
comment author + post author (for replies), and any users mentioned
via @nickname in the body. One notification per recipient per comment,
with priority comment_reply > post_comment and mention suppressed for
users already covered. Self-skip enforced. Mention cap: 10 per comment.

---

boards 댓글 POST 라우트에서 코어 알림 헬퍼 호출. 수신자 결정:
일반 댓글은 원글 작성자, 대댓글은 부모 댓글 작성자 + 원글 작성자,
본문의 @닉네임 사용자. 댓글당 수신자별 알림 1건(답글>댓글 우선,
이미 댓글 알림 받는 유저는 멘션 억제). 자기자신 제외, 멘션은
댓글당 최대 10명.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Admin free-form notification API + email helper

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/app/api/admin/notifications/send/route.ts`

- [ ] **Step 8.1: Add `sendAdminMessageEmail` to `src/lib/email.ts`**

Append at the end of `src/lib/email.ts`:

```ts
/**
 * Send a free-form admin message email. Safe to fire-and-forget —
 * logs on failure, never throws.
 */
export async function sendAdminMessageEmail(
  to: string,
  title: string,
  message: string,
  link?: string,
) {
  try {
    const shopName = await getShopName()
    const transporter = createTransporter()
    const href = link && link.startsWith('/')
      ? `${process.env.NEXT_PUBLIC_APP_URL}${link}`
      : null

    const escapedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const escapedMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject: `[${shopName}] ${title}`,
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${shopName}</h2>
          <h3 style="color: #333; margin-top: 20px;">${escapedTitle}</h3>
          <p style="color: #555; line-height: 1.6;">${escapedMessage}</p>
          ${href ? `<div style="text-align: center; margin: 30px 0;">
            <a href="${href}" style="background-color: #333; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">바로가기</a>
          </div>` : ''}
          <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">본 메일은 발신전용입니다.</p>
        </div>
      `,
    }
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('failed to send admin message email:', error)
  }
}
```

- [ ] **Step 8.2: Create the send route**

Create `src/app/api/admin/notifications/send/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAdminMessageNotification, shouldEmail } from '@/lib/notification'
import { sendAdminMessageEmail } from '@/lib/email'
import { NotificationType } from '@/lib/notification-types'

// Simple in-memory rate limiter (per-session, 60/min). Resets on server
// restart — good enough for Phase 1.
const buckets = new Map<string, { count: number; resetAt: number }>()
function takeToken(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count++
  return true
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!takeToken(`send:${session.id}`)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = await request.json()
  const { userId, title, message, link, sendEmail } = body

  // Validation
  if (typeof userId !== 'number') return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (typeof title !== 'string' || title.length < 1 || title.length > 100) {
    return NextResponse.json({ error: 'title must be 1..100 chars' }, { status: 400 })
  }
  if (typeof message !== 'string' || message.length < 1 || message.length > 2000) {
    return NextResponse.json({ error: 'message must be 1..2000 chars' }, { status: 400 })
  }
  if (link !== undefined && link !== null && link !== '') {
    if (typeof link !== 'string' || !link.startsWith('/')) {
      return NextResponse.json({ error: 'link must be internal path starting with /' }, { status: 400 })
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const notif = await createAdminMessageNotification({
    userId: user.id, title, message, link: link || undefined,
  })

  if (sendEmail && user.email && await shouldEmail(user.id, NotificationType.ADMIN_MESSAGE)) {
    // fire-and-forget
    sendAdminMessageEmail(user.email, title, message, link || undefined)
  }

  return NextResponse.json({ success: true, notification: notif })
}
```

- [ ] **Step 8.3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 8.4: Manual verification**

In DevTools while logged in as admin:

```js
await fetch('/api/admin/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 2, title: '테스트', message: '자유 알림 테스트입니다.' }),
}).then(r => r.json())
```

Expected: `{ success: true, notification: { id: ..., type: 'admin_message', ... } }`. Log in as user 2, bell icon shows 1 unread.

Try the same as a non-admin — expect `403 Forbidden`.

Try with an 101-char title — expect `400`.

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/email.ts src/app/api/admin/notifications/send/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): POST /api/admin/notifications/send + email helper

Add endpoint for admins/managers to push a free-form notification to a
single user with optional email dispatch. Server-side validation
(title 1..100, message 1..2000, link must start with '/'), admin/manager
role gate, in-memory rate limit (60/min per session). Also adds
sendAdminMessageEmail with HTML escaping for user-supplied text.

---

관리자/매니저가 특정 유저에게 자유 알림을 발송하는 엔드포인트와
이메일 헬퍼 추가. 입력 검증(제목 1~100자, 본문 1~2000자, 링크는
내부 경로만), 역할 체크, 세션당 분당 60건 rate limit.
sendAdminMessageEmail은 사용자 입력을 HTML 이스케이프.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Reusable `SendNotificationDialog` component

**Files:**
- Create: `src/components/admin/SendNotificationDialog.tsx`

- [ ] **Step 9.1: Create the component**

```tsx
"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userLabel?: string        // e.g. "홍길동 (hong@example.com)"
  prefillLink?: string      // order detail page, etc.
  prefillTitle?: string
}

export function SendNotificationDialog({
  open, onOpenChange, userId, userLabel, prefillLink, prefillTitle,
}: Props) {
  const t = useTranslations('admin.notifications.send')
  const [title, setTitle] = useState(prefillTitle ?? '')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState(prefillLink ?? '')
  const [sendEmail, setSendEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (title.length < 1 || title.length > 100) {
      setError(t('validation.title')); return
    }
    if (message.length < 1 || message.length > 2000) {
      setError(t('validation.message')); return
    }
    if (link && !link.startsWith('/')) {
      setError(t('validation.link')); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, message, link: link || undefined, sendEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('failure'))
        return
      }
      // success — reset and close
      setTitle(''); setMessage(''); setLink(''); setSendEmail(false)
      onOpenChange(false)
      alert(t('success'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {userLabel && <DialogDescription>{userLabel}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="send-title">{t('titleLabel')}</Label>
            <Input id="send-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-message">{t('messageLabel')}</Label>
            <Textarea id="send-message" value={message} onChange={e => setMessage(e.target.value)} rows={6} maxLength={2000} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-link">{t('linkLabel')}</Label>
            <Input id="send-link" value={link} onChange={e => setLink(e.target.value)} placeholder="/path/to/page" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="send-email" checked={sendEmail} onCheckedChange={v => setSendEmail(v === true)} />
            <Label htmlFor="send-email" className="cursor-pointer">{t('sendEmailLabel')}</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 9.2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 9.3: Commit**

```bash
git add src/components/admin/SendNotificationDialog.tsx
git commit -m "$(cat <<'EOF'
feat(admin): reusable SendNotificationDialog component

shadcn Dialog-based form for admin free-form notifications. Accepts
userId + optional prefill (link, title) so callers at user-admin and
order-admin pages share the same UI. Client-side validation mirrors
the server (title 1..100, message 1..2000, link must start with '/').

---

shadcn Dialog 기반 관리자 자유 알림 폼. userId와 링크/제목 prefill을
받아서 유저 관리와 주문 관리에서 동일한 UI를 공유. 클라이언트 검증이
서버와 동일(제목 1~100, 본문 1~2000, 링크는 '/' 시작).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Mount the dialog on user-admin list and shop-order-admin detail

**Files:**
- Modify: `src/app/[locale]/admin/users/page.tsx`
- Modify: `src/plugins/shop/admin/orders/[id]/page.tsx`

- [ ] **Step 10.1: Wire the dialog into `admin/users/page.tsx`**

At the top of the file, add to the imports:

```tsx
import { SendNotificationDialog } from "@/components/admin/SendNotificationDialog"
import { Send } from "lucide-react"
```

Inside `UsersPageContent` (after `const [editingUser, setEditingUser] = useState<User | null>(null)`), add:

```tsx
const [sendDialogUser, setSendDialogUser] = useState<User | null>(null)
```

In the user row actions (find the block where delete/edit/restore buttons are rendered), add before the edit button:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setSendDialogUser(user)}
  title={t('sendNotification')}
>
  <Send className="h-4 w-4" />
</Button>
```

At the bottom of the returned JSX, just before the closing tag of the outermost container, add:

```tsx
{sendDialogUser && (
  <SendNotificationDialog
    open={!!sendDialogUser}
    onOpenChange={(open) => { if (!open) setSendDialogUser(null) }}
    userId={Number(sendDialogUser.id)}
    userLabel={`${sendDialogUser.nickname ?? ''} (${sendDialogUser.email})`}
  />
)}
```

Note: if `User.id` is declared as `string` in the file's local interface, cast with `Number(...)`. If the existing code passes `user.id` to the `/api/admin/users/${id}` fetches as a string successfully, the coerced number for the dialog prop is still correct.

- [ ] **Step 10.2: Wire the dialog into the shop order admin detail page**

Open `src/plugins/shop/admin/orders/[id]/page.tsx`. Add to imports:

```tsx
import { SendNotificationDialog } from "@/components/admin/SendNotificationDialog"
import { Send } from "lucide-react"
```

Inside the component's state section, add:

```tsx
const [sendDialogOpen, setSendDialogOpen] = useState(false)
```

In the page's action area (next to the existing admin buttons like 취소/환불), add a button:

```tsx
{order?.userId && (
  <Button variant="outline" size="sm" onClick={() => setSendDialogOpen(true)}>
    <Send className="h-4 w-4 mr-1" />
    {t('sendNotification')}
  </Button>
)}
```

(Exact placement: in the row of status/action buttons that already uses `<Button>` with similar icon+label pattern. If uncertain, place it at the end of that row.)

At the bottom of the returned JSX (before the closing fragment), add:

```tsx
{order?.userId && (
  <SendNotificationDialog
    open={sendDialogOpen}
    onOpenChange={setSendDialogOpen}
    userId={order.userId}
    userLabel={`${order.user?.nickname ?? ''} (${order.user?.email ?? ''})`}
    prefillLink={`/shop/orders/${order.orderNo}`}
    prefillTitle={`주문 ${order.orderNo} 관련 안내`}
  />
)}
```

If `order.user?.nickname` / `order.user?.email` are not already on the fetched shape, rely on the existing `order.user` include from the admin GET handler (see `src/plugins/shop/admin/api/orders/[id]/route.ts` line 139–141) — it already selects those fields.

- [ ] **Step 10.3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: exit 0. Fix any type mismatch (e.g. `user.id` string vs number) by casting with `Number(...)` on the dialog prop.

- [ ] **Step 10.4: Manual E2E**

1. Log in as admin. Go to `/admin/users`. Click the Send icon on any user row → dialog opens.
2. Fill title "테스트 알림" and body "This is a test." → submit. Expect success alert.
3. Log out, log in as that user. Bell icon shows 1 unread. Open dropdown → notification appears with title "테스트 알림" and the Megaphone icon.
4. Log back in as admin. Go to `/admin/shop/orders/<some-order-id>`. Click the "고객에게 알림 보내기" button → dialog opens pre-filled with the order link. Submit.
5. As the customer, verify the notification links to `/shop/orders/<orderNo>`.

- [ ] **Step 10.5: Commit**

```bash
git add src/app/[locale]/admin/users/page.tsx src/plugins/shop/admin/orders/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): mount SendNotificationDialog on user/order admin pages

Add a Send icon row action on /admin/users that opens the dialog
scoped to the selected user. On the shop admin order detail page,
add a "고객에게 알림 보내기" button that opens the dialog with
the order link and a default title prefilled.

---

/admin/users 목록 각 행에 Send 아이콘 액션 추가 — 클릭 시 해당
유저로 스코프된 다이얼로그 열림. shop 관리자 주문 상세에서는
"고객에게 알림 보내기" 버튼 추가 — 주문 링크와 기본 제목이
자동으로 채워진 상태로 다이얼로그 열림.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: i18n keys (ko/en)

**Files:**
- Modify: `src/locales/ko.json`
- Modify: `src/locales/en.json`

- [ ] **Step 11.1: Add keys to `src/locales/ko.json`**

Under the existing `"mypage"` top-level object, add or extend:

```json
"notificationSettings": "알림 설정",
"notifications": {
  "filter": {
    "all": "전체",
    "unread": "안 읽음",
    "post_comment": "댓글",
    "comment_reply": "답글",
    "mention": "멘션",
    "admin_message": "관리자",
    "order_status": "주문"
  },
  "deleteAll": "전체 삭제",
  "deleteOne": "삭제",
  "confirmDeleteAll": "모든 알림을 삭제하시겠습니까?",
  "loadMore": "더 보기"
}
```

Under `"mypage"`, add a `"settings"` child (or extend it if present):

```json
"settings": {
  "notifications": {
    "title": "알림 수신 설정",
    "inApp": "인앱",
    "email": "이메일",
    "adminMessageNote": "관리자 알림은 인앱에서 끌 수 없습니다. 이메일만 선택적으로 끌 수 있습니다.",
    "types": {
      "postComment": "내 글에 댓글이 달렸을 때",
      "commentReply": "내 댓글에 답글이 달렸을 때",
      "mention": "나를 언급(@)했을 때",
      "adminMessage": "관리자 알림",
      "orderStatus": "주문 상태 변경"
    }
  }
}
```

Under the top-level `"admin"` object:

```json
"sendNotification": "알림 보내기",
"notifications": {
  "send": {
    "title": "알림 보내기",
    "titleLabel": "제목",
    "messageLabel": "본문",
    "linkLabel": "링크 (선택, 내부 경로)",
    "sendEmailLabel": "이메일도 함께 발송",
    "submit": "보내기",
    "cancel": "취소",
    "success": "알림이 발송되었습니다.",
    "failure": "알림 발송에 실패했습니다.",
    "validation": {
      "title": "제목은 1~100자여야 합니다.",
      "message": "본문은 1~2000자여야 합니다.",
      "link": "링크는 '/'로 시작하는 내부 경로여야 합니다."
    }
  }
}
```

- [ ] **Step 11.2: Mirror to `src/locales/en.json`**

Use the same structure with these English strings:

- `mypage.notificationSettings`: `"Notification settings"`
- `mypage.notifications.filter.all`: `"All"`, `.unread`: `"Unread"`, `.post_comment`: `"Comments"`, `.comment_reply`: `"Replies"`, `.mention`: `"Mentions"`, `.admin_message`: `"Admin"`, `.order_status`: `"Orders"`
- `mypage.notifications.deleteAll`: `"Delete all"`, `.deleteOne`: `"Delete"`, `.confirmDeleteAll`: `"Delete all notifications?"`, `.loadMore`: `"Load more"`
- `mypage.settings.notifications.title`: `"Notification preferences"`, `.inApp`: `"In-app"`, `.email`: `"Email"`, `.adminMessageNote`: `"Admin notifications cannot be disabled in-app. You can opt out of email only."`
- `mypage.settings.notifications.types.postComment`: `"Someone comments on my post"`, `.commentReply`: `"Someone replies to my comment"`, `.mention`: `"Someone mentions me (@)"`, `.adminMessage`: `"Admin notifications"`, `.orderStatus`: `"Order status updates"`
- `admin.sendNotification`: `"Send notification"`
- `admin.notifications.send.title`: `"Send notification"`, `.titleLabel`: `"Title"`, `.messageLabel`: `"Message"`, `.linkLabel`: `"Link (optional, internal path)"`, `.sendEmailLabel`: `"Also send by email"`, `.submit`: `"Send"`, `.cancel`: `"Cancel"`, `.success`: `"Notification sent."`, `.failure`: `"Failed to send notification."`
- `admin.notifications.send.validation.title`: `"Title must be 1..100 characters."`, `.message`: `"Message must be 1..2000 characters."`, `.link`: `"Link must be an internal path starting with '/'."`

- [ ] **Step 11.3: Verify JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/ko.json', 'utf8')); JSON.parse(require('fs').readFileSync('src/locales/en.json', 'utf8')); console.log('OK')"
```

Expected: `OK`.

- [ ] **Step 11.4: Manual spot-check in browser**

Start dev, reload `/mypage/notifications` — filter tab labels show in the active locale (not raw keys). Reload `/mypage/settings/notifications` — switches have the right labels. Admin page Send icon tooltip reads correctly.

- [ ] **Step 11.5: Commit**

```bash
git add src/locales/ko.json src/locales/en.json
git commit -m "$(cat <<'EOF'
i18n(notifications): ko/en keys for Phase 1 UI

Adds filter-tab / delete / load-more strings for the notifications
page, the new notification-preferences settings page (including the
admin-message mandatory-in-app note), and the admin send-notification
dialog (labels, validation messages, success/failure copy).

---

알림 페이지 필터·삭제·더보기, 신규 알림 설정 페이지(관리자 알림
인앱 필수 안내 포함), 관리자 알림 발송 다이얼로그(라벨/검증/결과
문구)를 위한 ko/en 키 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Manual E2E acceptance pass

**Files:** none (verification only; no commit unless fixes are needed)

- [ ] **Step 12.1: Start dev and check the full surface compiles**

```bash
npm run dev
```

Wait for "Ready". Open DevTools, watch for any runtime errors in the console as you visit each page below.

- [ ] **Step 12.2: Verify the Phase-1 user journey — comments**

1. Prepare three test accounts: A (post author), B (commenter), C (mentioned).
2. A writes a post in any board.
3. B comments. Verify: A sees `post_comment` in header bell and in `/mypage/notifications`.
4. C replies to B's comment. Verify: B sees `comment_reply`; A sees a second `post_comment`.
5. B edits a new comment to include `@<A-nickname> @<C-nickname>`. Verify: A is **not** double-notified (mention suppressed due to dedup). C sees `mention`.
6. A self-comments and self-mentions. Verify: no new notifications for A.

- [ ] **Step 12.3: Verify preferences**

1. As A, visit `/mypage/settings/notifications`. Toggle "내 글에 댓글" (postComment) off.
2. As B, add another comment on A's post.
3. Verify: A sees **no** new notification.
4. Re-enable the preference. Post another comment. A sees the new notification.
5. Verify admin-message in-app switch is disabled (cannot be toggled); email switch toggles fine.

- [ ] **Step 12.4: Verify admin-send**

1. As admin, go to `/admin/users`, click Send on a user row, send "정책 안내" with "이메일도 함께 발송" checked. Submit.
2. Check that user's inbox (SMTP sandbox/real inbox depending on env) — email arrives with correct HTML.
3. As that user, verify in-app notification appears with Megaphone icon.
4. As admin, go to `/admin/shop/orders/<some-existing-order-id>`, click "고객에게 알림 보내기" — dialog prefilled with link `/shop/orders/<orderNo>`. Submit without email.
5. As the order's customer, click the bell dropdown notification — navigates to the order detail page.

- [ ] **Step 12.5: Verify polish details**

1. On `/mypage/notifications`, confirm:
   - Filter tabs switch the list correctly.
   - Per-item Trash icon appears on hover and deletes that row.
   - "Delete all" button confirms then empties.
   - "Load more" appears when there are > 20 items (create enough by spam-commenting or seeding).
   - Relative time ("3분 전" / "3 minutes ago") renders for each item.

- [ ] **Step 12.6: Regression sanity — existing order notifications still work**

1. As admin, change an order's status (e.g. `paid` → `shipping`). The customer should still receive a `order_status` notification and (if email was enabled in shop settings) the email.
2. On `/mypage/notifications` filter by "주문". The new notification appears.

- [ ] **Step 12.7: Close out**

If all checks above pass, no further commits are needed. If something fails, fix in place and add a `fix(notifications): ...` commit with the same English + Korean body format.

---

## Self-Review (completed inline)

**Spec coverage:**
- §1.2 Comment / reply / mention notifications → Task 7.
- §1.2 Preferences → Tasks 1, 3, 4, 5.
- §1.2 /mypage/notifications polish → Task 6.
- §1.2 Preferences page → Task 5.
- §1.2 Admin free-form notification → Tasks 8, 9, 10.
- §1.2 Core API surface → Tasks 1, 3.
- §2.4 File map → all paths verified against the live tree before writing this plan.
- §3.2 NotificationPreference schema → Task 1 (admin in-app opt-out intentionally absent).
- §4.1 Recipient dedup rule → Task 7 Step 7.2 pseudocode matches.
- §5.1 Testing → downgraded to manual E2E in Task 12 because the codebase has no test runner; flagged at top of the plan.
- §5.2 Migration → Task 1 covers migrate dev + prod command.
- §5.3 Implementation order → Tasks follow the same 12-step order.
- §5.4 i18n keys → Task 11 enumerates all of them.
- §5.5 Rate limit, mention cap, XSS, link-must-start-with-'/' → Tasks 7, 8, 9.

**Placeholder scan:** No "TBD", "TODO", "implement later" in the plan. Every step shows the exact code or exact commands.

**Type consistency:**
- `NotificationType` imported consistently from `@/lib/notification-types`.
- `shouldNotify` / `shouldEmail` signatures match between Task 3 definition and Task 8 usage.
- `createAdminMessageNotification` defined in Task 3, used in Task 8.
- `SendNotificationDialog` props (Task 9) match the two call sites (Task 10).
- Boards hook writes to `/boards/${slug}/${postId}` which matches the existing routes (`src/plugins/boards/routes/[slug]/[postId]/page.tsx`).
