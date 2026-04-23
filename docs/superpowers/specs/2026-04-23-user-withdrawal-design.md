# User Withdrawal Design — Account Deletion with Plugin-Declared Data Policy

**Date:** 2026-04-23
**Scope:** Core (`src/lib`, User schema, `src/app/api`, mypage route) + plugin manifest contract
**Status:** Design drafted; pending user review

## Summary

Add a user-initiated account withdrawal (탈퇴) feature. On withdrawal, the User row is anonymized synchronously (email/nickname/name/phone cleared), releasing unique constraints so the same email may re-register as a new account. Related data is handled according to each plugin's declared policy: business-owned content (orders) is retained under legal retention rules, shared/public content (posts, reviews, messages) is retained with the user anonymized, and personal-only data (wishlist, addresses, notifications) is deleted. Plugins must declare withdrawal policy for every model that references `User.id`; the build refuses to compile if any reference is undeclared. A post-withdrawal verification sweep detects stale references.

## Goals

1. User self-service withdrawal from 마이페이지 with a single confirmation step (password re-verification + summary counts).
2. Immediate anonymization of personal identifiers on the User row (email, nickname, name, phone, image, password, OAuth providerId). Same email may re-register immediately as a new account.
3. Compliance with Korean 전자상거래법: order/payment records retained 5 years, dispute records 3 years, login logs 3 months (preserved via existing order snapshot columns).
4. **Verifiable, plugin-safe data handling**: every plugin that references `User.id` declares withdrawal policy in its manifest. Build-time validator refuses undeclared references. Admin page auto-generates the user-facing privacy policy summary from these declarations.
5. Fault-tolerant execution: withdrawal completes for the user even if downstream cleanup (e.g., notification deletion batches) fails mid-way; a job row remains for retry.
6. Audit trail: `withdrawal_jobs` retained indefinitely as a record of who withdrew and when.

## Non-Goals

- Grace period / undo window. Withdrawal is immediate and irreversible.
- Linking re-registered accounts to prior history. Re-registration creates a clean new account; past data is not surfaced to the user.
- Admin-initiated withdrawal (that is covered by existing `User.status='suspended'` flow — out of scope here).
- Withdrawal-reason analytics dashboard. We collect reasons but do not build reporting in this spec.
- External job queue (Redis/BullMQ). In-DB job table with fire-and-forget execution is sufficient for current scale.
- Crypto-shredding of historical data. Standard anonymization is the chosen approach.

## Architecture Decision: Plugin-Declared Policy + Build-Time Validation

Each plugin declares, in its `plugin.ts` manifest, how every model that references `User.id` is handled on user withdrawal. The core orchestrates withdrawal by reading declarations from all enabled plugins. A build-step validator scans plugin Prisma schemas for references to `User` and fails the build if any model lacks a declared policy.

Rejected alternatives:

- **Runtime handler registration** — plugin authors can silently forget to register. Build passes even when cleanup is broken. No static audit. Rejected.
- **Core enumerates tables directly** — couples core to every plugin's schema. Core must be edited for each new plugin. Rejected.
- **Cascade-delete everywhere** — destroys shared content (other users' comments on the withdrawn user's posts, answer text on the withdrawn user's Q&A). Data integrity concern raised during brainstorming. Rejected.
- **Delete all user content (reviews, posts, comments, messages)** — originally considered, rejected due to cascade fallout on other users' replies/comments, aggregate caches (review counts, ratings), and conversation context.

## 1. Data Model

### 1.1 Modified table: `users` (core)

Existing columns used: `status`, `deletedAt`, `adminNote`. No schema changes required — anonymization is performed by UPDATE, not by schema modification.

Anonymization writes on withdrawal:

```
email        = 'deleted_' || generate_uuid() || '@deleted.local'   -- releases unique
nickname     = '탈퇴한회원_' || substr(uuid, 1, 6)                    -- releases unique
name         = NULL
phone        = NULL
image        = NULL
password     = NULL
provider     = NULL
providerId   = NULL
emailVerified= NULL
lastLoginIp  = NULL
status       = 'withdrawn'
deletedAt    = NOW()
```

The User row is **retained** with its original `id`. This keeps foreign key references valid across all plugins. Displayed nickname "탈퇴한회원_xxxxxx" appears wherever the User is joined (posts, comments, reviews, messages).

### 1.2 New table: `withdrawal_jobs` (core)

One row per withdrawal event. Retained indefinitely as audit log.

```sql
CREATE TABLE withdrawal_jobs (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  userId       INT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
               -- 'pending' | 'running' | 'done' | 'failed'
  attempts     INT NOT NULL DEFAULT 0,
  lastError    TEXT NULL,
  reasonCode   VARCHAR(40) NULL,        -- radio choice, e.g. 'rarely_used', 'no_feature', 'moved_service', 'privacy', 'other'
  reasonText   VARCHAR(500) NULL,       -- free text, only when reasonCode = 'other'
  createdAt    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  startedAt    DATETIME(3) NULL,
  completedAt  DATETIME(3) NULL,
  INDEX (status, createdAt),
  INDEX (userId),
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

`userId` references the anonymized User row (same id). No email or personally identifiable data is stored here — only the meaningless user key and job metadata.

## 2. Plugin Manifest Contract

### 2.1 Declaration

Plugins extend their `plugin.ts` with a `userData` block:

```ts
export default definePlugin({
  name: 'Shop',
  slug: 'shop',
  ...
  userData: {
    onUserWithdrawal: [
      { model: 'Order',         policy: 'retain',
        reason: '전자상거래법 — 계약/결제/재화공급 기록 5년 보관 의무' },
      { model: 'OrderActivity', policy: 'retain-via-parent', parent: 'Order' },
      { model: 'OrderItem',     policy: 'retain-via-parent', parent: 'Order' },
      { model: 'ProductReview', policy: 'retain',
        reason: 'Public review; anonymized via User join' },
      { model: 'ProductQna',    policy: 'retain',
        reason: 'Product info with admin replies; anonymized via User join' },
      { model: 'Wishlist',      policy: 'delete' },
      { model: 'PendingOrder',  policy: 'delete' },
    ],
  },
})
```

### 2.2 Policy types

| Policy | Meaning | Implementation |
|---|---|---|
| `retain` | Row is kept. User column remains pointing to anonymized User. | No-op at withdrawal time. |
| `retain-via-parent` | Row is kept because a parent row is kept. | No-op; documentation only. |
| `delete` | Row is deleted on withdrawal. | Batched `DELETE WHERE userId = ?`. |
| `custom` | Complex handler required. | Handler function in plugin code. |

### 2.3 Custom handler shape (for complex cases)

Some models may require logic that `retain` / `delete` / `retain-via-parent` cannot express — e.g., a hypothetical model with encrypted payloads requiring per-row key rotation, or multi-field matching with branching. These declare `policy: 'custom'` and provide a handler reference:

```ts
{ model: 'FutureModel', policy: 'custom', handler: 'cleanupFutureModel' }
// handler name is a string, resolved via the plugin's exported cleanup registry,
// keeping plugin.ts serializable and inspectable without executing code
```

For the current design pass, no plugin requires `custom` — every model fits `retain` / `delete` / `retain-via-parent`. The `custom` slot is defined as an extensibility point but has no initial consumers.

## 3. Build-Time Validation

### 3.1 Validator

A Node script runs as part of the existing schema merge step (`prisma/schema.base.prisma` + plugin `schema.prisma` files → generated `prisma/schema.prisma`). It also loads each plugin's manifest.

For each plugin:

1. Parse the plugin's `schema.prisma` and `schema.user.prisma` into an AST.
2. Collect every model that has a field referencing `User` (via `@relation` to `User`, or a field named `userId`/`authorId`/etc. that is an `Int` with `@relation` to User).
3. Compare to the plugin's `userData.onUserWithdrawal` declarations.
4. Fail the build if any model is un-declared.

### 3.2 Failure output

```
[withdrawal-validator] Scanning plugin schemas for User references...
[withdrawal-validator] ✓ shop: 7 models with User references, all declared
[withdrawal-validator] ✗ boards: Model 'Post' references User but has no onUserWithdrawal policy
[withdrawal-validator] ✗ boards: Model 'Comment' references User but has no onUserWithdrawal policy

Build failed. Every plugin model referencing User.id must declare a withdrawal
policy in plugin.ts userData.onUserWithdrawal.
See docs/withdrawal-policy.md
```

This is the **core safety property** of the design: a plugin cannot be built or installed without disclosing what happens to its user data on withdrawal.

### 3.3 Integration point

The validator hooks into the same script that generates `prisma/schema.prisma` from base + plugin schemas (the existing `schema merging` step per CLAUDE.md memory). Validation runs after merge, before `prisma generate`.

## 4. Withdrawal Execution — Two Phases

### Phase 1: Synchronous (inside the API request)

Performed in a single DB transaction. Fast; completes before the user sees confirmation.

1. Verify password (or OAuth re-auth signal) against the logged-in user.
2. Start transaction.
3. Update `users` row with anonymization writes (§1.1).
4. Delete all `accounts` rows for this user (OAuth unlink, for security reasons needed in Phase 1 — Phase 2's subsequent `deleteMany` on `Account` is idempotent).
5. Insert `withdrawal_jobs` row with `status='pending'` and the submitted `reasonCode`/`reasonText`.
6. Commit.
7. Invalidate NextAuth session / clear cookies on response.
8. Return 200 to the browser. Fire-and-forget `processWithdrawalJob(userId)` (no await).

After Phase 1, the user experience is complete: cookies cleared, cannot log in as themselves, email freed for re-registration.

### Phase 2: Asynchronous (fire-and-forget background cleanup)

Runs in the same Node.js process but outside the request lifecycle. Safe against interruption: if the process crashes mid-way, the `withdrawal_jobs` row remains `pending` or `running` and will be picked up by the retry sweep.

1. Load `withdrawal_jobs` row, set `status='running'`, `startedAt=NOW()`, `attempts++`.
2. Load all enabled plugins' `userData.onUserWithdrawal` declarations.
3. For each `{ model, policy }`:
   - If `policy='delete'`: batched `prisma.<model>.deleteMany({ where: { <userField>: userId } })`. Batch size 500.
   - If `policy='retain'` / `'retain-via-parent'`: no-op.
   - If `policy='custom'`: invoke handler with `(userId, prisma)`.
4. On success: `status='done'`, `completedAt=NOW()`.
5. On failure: `status='failed'`, `lastError=<message>`. Row remains for retry.

Batching avoids long locks and timeouts. Each batch is its own transaction.

### Phase 2 retry sweep

A cron-like sweep (implementation: either `node-cron` or an admin-triggered button; decision deferred to plan) runs hourly:

- Pick up `withdrawal_jobs` where `status IN ('pending', 'failed')` AND `attempts < 5`.
- Also pick up `status='running'` rows older than 30 minutes (likely orphaned by a crash).
- Re-run Phase 2 for each.
- After 5 attempts, leave `status='failed'` for admin attention.

## 5. Post-Withdrawal Verification Sweep

A nightly (or on-demand) verifier ensures no stale rows exist for withdrawn users.

1. Fetch all `withdrawal_jobs` with `status='done'` and `completedAt > NOW() - INTERVAL 30 DAY`.
2. For each userId:
   - Walk the manifest declarations.
   - For every `policy='delete'` model, count rows matching `userId = X`. Expect 0.
   - If non-zero, emit alert (log + admin notification).

This is the second safety net: even if a plugin declaration is wrong or cleanup silently fails, the sweep surfaces it. Output goes to the admin privacy page.

## 6. Admin Privacy Audit Page

New page at `/admin/privacy/withdrawal-policy`.

Auto-generated from all enabled plugins' manifests:

- Table of all models, grouped by policy (`retain`, `delete`, `custom`).
- Reason text shown for each `retain` entry.
- Link to the user-facing privacy policy (which is also generated from the same source).
- List of recent `withdrawal_jobs` with status, timestamps, and any `lastError`.
- List of flagged verification sweep findings (stale rows detected).
- Manual re-run button for failed jobs.

## 7. User-Facing UX — Withdrawal Flow

Route: `/mypage/account/withdraw` (mypage subpage).

### 7.1 Layout

```
회원 탈퇴

아래 내용을 확인해주세요.

[ 삭제되는 정보 ]
  • 위시리스트 12개
  • 배송지 3개
  • 수신 알림 설정
  • 소셜 로그인 연동 정보

[ 익명 처리되는 정보 ]
  • 내가 쓴 게시글 5개, 댓글 34개
  • 내가 쓴 상품 리뷰 2개
  • 내가 주고받은 메시지 대화
  → 작성자명이 "탈퇴한회원_xxxxxx"로 바뀌며 글 내용은 남습니다.

[ 법적으로 유지되는 정보 ]
  • 주문 내역 12건 (5년간 보관 후 파기 — 전자상거래법)
  → 재가입하셔도 조회할 수 없습니다.

[ 탈퇴 사유 (선택) ]
  ○ 서비스를 잘 사용하지 않음
  ○ 원하는 기능이 없음
  ○ 비슷한 다른 서비스로 이동
  ○ 개인정보 걱정
  ○ 기타  [ textarea, 500자 제한, 라디오 '기타' 선택 시만 노출 ]

[ 비밀번호 확인 ]
  [                               ]

[ 취소 ] [ 탈퇴하기 ]
```

Counts are computed at page load via the manifest: for each `policy='delete'` / `'retain'` model, run `count({ where: { userId } })`. Categorized by policy type in the display.

### 7.2 Client-side

Simple form. On submit:

- Validate password field is non-empty.
- POST `/api/me/withdraw` with `{ password, reasonCode, reasonText? }`.
- On success: redirect to home with a one-time "탈퇴가 완료되었습니다" toast.
- On password failure: inline error, stay on page.

### 7.3 OAuth-only users

If `User.password IS NULL` (OAuth-only account), replace password field with an "OAuth 재인증" button that triggers a sign-in flow for the provider, then confirms withdrawal. Implementation detail deferred to plan.

## 8. API Surface

### `POST /api/me/withdraw`

Request body:

```ts
{
  password?: string,        // required if User has a password
  oauthReverifyToken?: string, // required for OAuth-only users
  reasonCode?: 'rarely_used' | 'no_feature' | 'moved_service' | 'privacy' | 'other',
  reasonText?: string,      // max 500 chars, only when reasonCode='other'
}
```

Response: `200 { ok: true }` or `401 { error: 'invalid_password' }` or `400 { error: 'validation_failed' }`.

Side effects (synchronous Phase 1): as specified in §4.

### `GET /api/me/withdraw/preview`

Returns counts for the withdrawal page:

```ts
{
  toDelete: [{ model: 'Wishlist', count: 12 }, ...],
  toRetainAnonymized: [{ model: 'Post', count: 5 }, ...],
  toRetainLegal: [{ model: 'Order', count: 12, retentionYears: 5 }, ...],
}
```

Generated by walking the manifest and counting per userId.

## 9. Plugin Manifests — Initial Declarations

Each existing plugin's `plugin.ts` gains a `userData` block. Below are the declarations for current plugins.

### shop

```ts
userData: {
  onUserWithdrawal: [
    { model: 'Order',         policy: 'retain',
      reason: '전자상거래법 — 계약/결제/재화공급 기록 5년 보관 의무' },
    { model: 'OrderItem',     policy: 'retain-via-parent', parent: 'Order' },
    { model: 'OrderActivity', policy: 'retain-via-parent', parent: 'Order' },
    { model: 'ProductReview', policy: 'retain',
      reason: 'Public review; anonymized via User join' },
    { model: 'ProductQna',    policy: 'retain',
      reason: 'Product info with admin replies; anonymized via User join' },
    { model: 'Wishlist',      policy: 'delete' },
    { model: 'PendingOrder',  policy: 'delete' },
  ],
}
```

### boards

```ts
userData: {
  onUserWithdrawal: [
    { model: 'Post',     policy: 'retain',
      reason: 'Public content; anonymized via User join' },
    { model: 'Comment',  policy: 'retain',
      reason: 'Public content; anonymized via User join' },
    { model: 'Reaction', policy: 'retain',
      reason: 'Affects aggregate like counts; anonymized via User join' },
  ],
}
```

(`PostAttachment` has no direct User reference — it cascades through `Post`.)

### Other existing plugins

`contents`, `polls`, `countdown-timer`, `weather-widget`, `vibe-coding-recipes`, `policies` — each is audited in Phase 1 of implementation. Any with User references gets declarations; any without leaves `userData` absent.

### Core models (not inside a plugin)

Core-owned User-referencing models (`UserAddress`, `Notification`, `NotificationPreference`, `Conversation`, `Message`, `Account`) need a policy too. Solution: the core registers its own `userData` block in a dedicated manifest file `src/lib/core-withdrawal-policy.ts`, treated by the validator as a pseudo-plugin named `core`.

```ts
// src/lib/core-withdrawal-policy.ts
export const coreWithdrawalPolicy = {
  onUserWithdrawal: [
    { model: 'UserAddress',            policy: 'delete' },
    { model: 'Notification',           policy: 'delete' },
    { model: 'NotificationPreference', policy: 'delete' },
    { model: 'Account',                policy: 'delete' },
    { model: 'Conversation',           policy: 'retain',
      reason: 'Other participant\'s conversation record is preserved; withdrawn user appears as "탈퇴한회원_xxxxxx"' },
    { model: 'Message',                policy: 'retain',
      reason: 'Conversation history preserved; sender anonymized via User join' },
  ],
}
```

Both `user1Id`/`user2Id` on `Conversation` and `senderId` on `Message` remain pointing at the anonymized User row. The other participant continues to see the conversation normally, with the withdrawn user's name rendered as "탈퇴한회원_xxxxxx".

## 10. Edge Cases

### 10.1 Re-registration with same email

After Phase 1, `users.email` has been set to `deleted_<uuid>@deleted.local`. The real email is no longer in the `users` table. A new signup flow with that email succeeds because the unique constraint is free. The new User row has a fresh `id`. No linkage to prior history is surfaced to the new user.

Note: `orders.ordererEmail` still contains the original email for 5 years under retention rules. Admin-side order lookup by email will still find those past orders — this is the intended legal behavior. The withdrawn user cannot access them, because they are no longer logged in as the owning userId.

### 10.2 Withdrawal during an active order

If the user has an order with `status IN ('pending', 'paid', 'shipped')`, the order remains with its retained snapshot data (name, phone, address). Shop admin can still fulfill it; tracking updates still work. The order is linked to an anonymized User row but that is fine — admin views use `ordererName`/`ordererPhone`/`recipientName` from the order itself, not the User table.

### 10.3 Pending job crash

If Phase 2 crashes partway:
- `withdrawal_jobs` row stays `running` or `failed`.
- Hourly sweep picks it up and retries.
- After 5 attempts, row stays `failed` for admin attention.
- User experience is unaffected (Phase 1 already completed).

### 10.4 Plugin disabled after withdrawal

If plugin X was enabled when user withdrew but disabled before Phase 2 runs, its policies won't be consulted during cleanup. Solution: validator + runtime loader iterates `pluginManifest` (the generated artifact), not `isPluginEnabled`. Cleanup is driven by what is *installed*, not what is *enabled*.

### 10.5 Race: user logged in elsewhere during withdrawal

NextAuth sessions are JWT. We cannot proactively invalidate other devices' tokens instantly. Mitigation: the JWT session callback checks `user.status`. If `status='withdrawn'`, the session is refused. Implementation: add this check to the existing `session` callback in `src/lib/auth.ts`.

## 11. File & Module Layout

```
src/lib/
├── withdrawal/
│   ├── types.ts                  # UserDataPolicy, PluginWithdrawalManifest types
│   ├── validator.ts              # build-time validator
│   ├── execute.ts                # Phase 1 + Phase 2 orchestration
│   ├── verify.ts                 # post-withdrawal verification sweep
│   └── preview.ts                # counts for /api/me/withdraw/preview
└── core-withdrawal-policy.ts     # core's own userData block

src/app/api/me/withdraw/
├── route.ts                      # POST (execute) + GET (preview)

src/app/[locale]/mypage/account/withdraw/
├── page.tsx                      # withdrawal UI

src/app/[locale]/admin/privacy/withdrawal-policy/
├── page.tsx                      # admin audit page

prisma/schema.base.prisma         # + model WithdrawalJob

scripts/
├── validate-withdrawal-policy.ts # run as part of schema merge step
```

## 12. Migration / Rollout

1. Add `WithdrawalJob` model to `prisma/schema.base.prisma`; migrate.
2. Add `userData` block to each existing plugin's `plugin.ts` (no code change, just declaration).
3. Add core withdrawal policy at `src/lib/core-withdrawal-policy.ts`.
4. Wire validator into schema merge script. Run on CI and locally.
5. Implement execute + preview + verify modules.
6. Add API routes, mypage UI, admin UI.
7. Add JWT session callback check for `status='withdrawn'`.
8. End-to-end test: register → create data across plugins → withdraw → verify preview counts match, verify Phase 2 cleanup, verify re-registration works, verify withdrawn session is refused on refresh.
9. Update user-facing 개인정보처리방침 to reference the admin audit page as the canonical source of truth.

No existing data migrations required — the design operates on new withdrawals going forward.

## 13. Testing Strategy

- **Unit**: validator AST parsing; preview counter; individual cleanup handlers.
- **Integration**: full withdrawal flow against a test database — seeded user with data across all plugins, run withdrawal, assert state.
- **Negative**: missing declaration in a test plugin causes build failure with correct error message.
- **Concurrency**: two simultaneous withdrawal requests for the same user both succeed idempotently (second one sees anonymized email, noop).
- **Session**: existing session for withdrawn user is refused on next request.

## 14. Open Questions — For Implementation Plan

These surface during planning, not here:

- Exact mechanism for "fire-and-forget" in Next.js server — `setImmediate` vs. `queueMicrotask` vs. a module-level async scheduler? Implementation plan will pick one.
- Sweep implementation — cron inside the Next process (`node-cron`) vs. admin-triggered endpoint only? Decision in plan.
- OAuth re-verification UX — which providers, whether a dedicated re-auth endpoint is needed.
- Whether to expose withdrawal reasons in a basic admin list view in this pass, or leave it as raw DB until a dashboard is warranted.

## 15. Acceptance Criteria

- [ ] User at `/mypage/account/withdraw` sees correct counts per category.
- [ ] POST withdrawal with correct password completes Phase 1 and returns 200 in < 500ms.
- [ ] User is logged out immediately; attempting to reuse the old session fails.
- [ ] Same email can register a new account within the same minute.
- [ ] Phase 2 completes: wishlist/addresses/notifications/accounts are zero for the withdrawn userId.
- [ ] Orders for the withdrawn userId remain intact and accessible to admin.
- [ ] Posts/comments/reviews by the withdrawn userId display "탈퇴한회원_xxxxxx" instead of original nickname, content unchanged.
- [ ] Build fails when a test plugin adds a User-referencing model without declaration.
- [ ] Admin audit page at `/admin/privacy/withdrawal-policy` renders the complete policy table and lists recent jobs.
- [ ] Verification sweep detects intentionally-left stale rows in a seeded test.
