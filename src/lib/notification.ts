import { prisma } from '@/lib/prisma'

export type NotificationType = 'order_status' | 'review_reply' | 'qna_reply' | 'system'

interface CreateNotificationParams {
  userId: number
  type: NotificationType
  title: string
  message: string
  link?: string
}

/**
 * 알림 생성
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
      }
    })
  } catch (error) {
    console.error('알림 생성 에러:', error)
    return null
  }
}

/**
 * 주문 상태 변경 알림 생성
 */
export async function createOrderStatusNotification(
  userId: number,
  orderNo: string,
  oldStatus: string,
  newStatus: string
) {
  const statusLabels: Record<string, string> = {
    pending: '결제 대기',
    paid: '결제 완료',
    preparing: '배송 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '주문 취소',
    cancel_requested: '취소 요청',
    refund_requested: '환불 요청',
    refunded: '환불 완료',
  }

  const statusMessages: Record<string, string> = {
    paid: '결제가 완료되었습니다.',
    preparing: '상품을 준비하고 있습니다.',
    shipping: '상품이 발송되었습니다. 배송을 시작합니다.',
    delivered: '상품이 배송 완료되었습니다.',
    cancelled: '주문이 취소되었습니다.',
    refunded: '환불이 완료되었습니다.',
  }

  const title = `주문 상태 변경: ${statusLabels[newStatus] || newStatus}`
  const message = statusMessages[newStatus] || `주문 상태가 "${statusLabels[newStatus] || newStatus}"(으)로 변경되었습니다.`

  return createNotification({
    userId,
    type: 'order_status',
    title,
    message: `[주문번호: ${orderNo}] ${message}`,
    link: `/shop/orders/${orderNo}`,
  })
}
