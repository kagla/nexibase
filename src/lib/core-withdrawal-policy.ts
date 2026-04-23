// Core (non-plugin) models that reference User.id. Treated by the validator as
// a pseudo-plugin named 'core'. Edit this file when core schema adds or removes
// any User-referencing model.

export default [
  { model: 'UserAddress',            policy: 'delete' },
  { model: 'Notification',           policy: 'delete' },
  { model: 'NotificationPreference', policy: 'delete' },
  { model: 'Account',                policy: 'delete', reason: 'Also deleted in Phase 1 for immediate OAuth unlink; Phase 2 re-run is idempotent' },
  { model: 'Conversation',           policy: 'retain', reason: 'Other participant\'s conversation record is preserved; withdrawn user rendered as 탈퇴한회원_xxxxxx via User join. Multi-FK model (user1Id/user2Id) — preview count omitted; Message count serves as activity proxy.' },
  { model: 'Message',                policy: 'retain', field: 'senderId', reason: 'Conversation history preserved; sender anonymized via User join' },
  { model: 'WithdrawalJob',          policy: 'retain', reason: 'This IS the withdrawal audit record; retaining our own row is correct' },
]
