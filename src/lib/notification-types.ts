// Canonical notification type identifiers. Kept as string literals so
// stored values remain readable in the DB and existing values stay
// backward compatible.
export const NotificationType = {
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  MENTION: 'mention',
  ADMIN_MESSAGE: 'admin_message',
  DIRECT_MESSAGE: 'direct_message',
  ORDER_STATUS: 'order_status',
} as const

export type NotificationTypeValue =
  typeof NotificationType[keyof typeof NotificationType]

// Types whose in-app delivery the user can toggle off. Types omitted
// here are delivered in-app unconditionally (ADMIN_MESSAGE historically
// for admin reach; DIRECT_MESSAGE for the same reason — see Phase 2 spec
// §3.5).
export const PREFERENCE_CONTROLLED_TYPES: NotificationTypeValue[] = [
  NotificationType.POST_COMMENT,
  NotificationType.COMMENT_REPLY,
  NotificationType.MENTION,
  NotificationType.ORDER_STATUS,
]
