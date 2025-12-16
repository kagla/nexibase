import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// 배송 전 상태인지 확인 (취소 시 전액 환불 대상)
function isBeforeShipping(status: string): boolean {
  return ['pending', 'paid', 'preparing'].includes(status)
}

// 이니시스 결제 취소 호출
async function cancelCardPayment(orderNo: string, cancelAmount: number, cancelReason: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/shop/payment/inicis/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNo,
        cancelAmount,
        cancelReason
      })
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('카드 결제 취소 호출 에러:', error)
    return { success: false, error: '카드 결제 취소 호출 실패' }
  }
}

// 주문 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderNo } = await params

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        items: {
          include: {
            product: {
              select: {
                slug: true,
                images: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인 주문만 조회 가능 (관리자 제외)
    if (order.userId !== session.id && session.role !== 'admin') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 이미지 처리
    const orderWithImages = {
      ...order,
      items: order.items.map(item => {
        const images = item.product?.images
        let firstImage = null
        if (images) {
          try {
            const parsed = JSON.parse(images)
            firstImage = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null
          } catch {
            firstImage = null
          }
        }
        return {
          ...item,
          productImage: firstImage,
          productSlug: item.product?.slug || null,
          product: undefined
        }
      })
    }

    return NextResponse.json({ order: orderWithImages })
  } catch (error) {
    console.error('주문 상세 조회 에러:', error)
    return NextResponse.json(
      { error: '주문을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 주문 취소/환불 요청
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderNo } = await params
    const body = await request.json()
    const { action, cancelReason } = body

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인 주문만 수정 가능
    if (order.userId !== session.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 취소 요청 (배송 전: 전액 환불)
    if (action === 'cancel') {
      // 취소 가능한 상태 확인 (배송 전까지만)
      if (!isBeforeShipping(order.status)) {
        return NextResponse.json(
          { error: '배송 전 상태에서만 취소할 수 있습니다. 배송 후에는 환불 요청을 이용해주세요.' },
          { status: 400 }
        )
      }

      if (!cancelReason) {
        return NextResponse.json(
          { error: '취소 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 카드 결제인 경우 자동 취소
      let cardCancelResult = null
      if (order.paymentMethod === 'card' && order.pgTid) {
        cardCancelResult = await cancelCardPayment(orderNo, order.totalAmount, cancelReason)

        if (!cardCancelResult.success) {
          console.error('카드 결제 취소 실패:', cardCancelResult)
          // 테스트 모드가 아닌 실제 결제에서 실패하면 에러 반환
          // (테스트 모드에서는 cancelCardPayment가 성공으로 처리함)
          if (!cardCancelResult.message?.includes('테스트')) {
            return NextResponse.json(
              { error: '카드 결제 취소에 실패했습니다. 고객센터로 문의해주세요.' },
              { status: 400 }
            )
          }
        }
      }

      // 재고 복구 + 주문 취소
      await prisma.$transaction(async (tx) => {
        // 재고 복구
        for (const item of order.items) {
          if (item.optionId) {
            await tx.productOption.update({
              where: { id: item.optionId },
              data: {
                stock: { increment: item.quantity }
              }
            })
          }
          // 판매 수량 감소
          await tx.product.update({
            where: { id: item.productId },
            data: {
              soldCount: { decrement: item.quantity }
            }
          })
        }

        // 주문 상태 변경 (전액 환불)
        await tx.order.update({
          where: { orderNo },
          data: {
            status: 'cancelled',
            cancelReason,
            cancelledAt: new Date(),
            refundAmount: order.totalAmount,  // 전액 환불
            refundedAt: new Date()
          }
        })
      })

      return NextResponse.json({
        success: true,
        message: order.paymentMethod === 'card'
          ? '주문이 취소되고 결제가 환불 처리되었습니다.'
          : '주문이 취소되었습니다.',
        refundAmount: order.totalAmount,
        cardCancelResult
      })
    }

    // 환불 요청 (배송 후: 반품 배송비 차감)
    if (action === 'refund_request') {
      // 환불 요청 가능한 상태 확인
      if (!['shipping', 'delivered'].includes(order.status)) {
        return NextResponse.json(
          { error: '배송중 또는 배송완료 상태에서만 환불 요청할 수 있습니다.' },
          { status: 400 }
        )
      }

      if (!cancelReason) {
        return NextResponse.json(
          { error: '환불 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 반품 배송비 조회
      const settings = await getShopSettings()
      const returnShippingFee = parseInt(settings.return_shipping_fee || '5000')

      // 환불 예정 금액 계산
      const refundAmount = Math.max(0, order.totalAmount - returnShippingFee)

      await prisma.order.update({
        where: { orderNo },
        data: {
          status: 'refund_requested',
          cancelReason,
          // 예상 환불 금액 저장 (관리자가 최종 확정)
          refundAmount
        }
      })

      return NextResponse.json({
        success: true,
        message: '환불 요청이 접수되었습니다.',
        returnShippingFee,
        expectedRefundAmount: refundAmount
      })
    }

    // 구매 확정
    if (action === 'confirm') {
      if (order.status !== 'delivered') {
        return NextResponse.json(
          { error: '배송 완료된 주문만 구매 확정할 수 있습니다.' },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { orderNo },
        data: {
          status: 'confirmed'
        }
      })

      return NextResponse.json({
        success: true,
        message: '구매가 확정되었습니다.'
      })
    }

    return NextResponse.json(
      { error: '유효하지 않은 요청입니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 수정 에러:', error)
    return NextResponse.json(
      { error: '주문 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
