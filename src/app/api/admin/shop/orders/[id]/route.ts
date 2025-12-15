import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 주문 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        items: {
          include: {
            product: {
              select: { slug: true, images: true }
            }
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

// 주문 상태 변경
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()
    const {
      status,
      trackingCompany,
      trackingNumber,
      adminMemo,
      refundAmount,
    } = body

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // 상태 변경
    if (status && status !== order.status) {
      updateData.status = status

      // 상태별 추가 처리
      switch (status) {
        case 'paid':
          updateData.paidAt = new Date()
          break
        case 'shipping':
          updateData.shippedAt = new Date()
          if (trackingCompany) updateData.trackingCompany = trackingCompany
          if (trackingNumber) updateData.trackingNumber = trackingNumber
          break
        case 'delivered':
          updateData.deliveredAt = new Date()
          break
        case 'cancelled':
          updateData.cancelledAt = new Date()
          // 재고 복구
          await restoreStock(order.items)
          break
        case 'refunded':
          updateData.refundedAt = new Date()
          if (refundAmount) updateData.refundAmount = refundAmount
          // 재고 복구 (아직 복구 안된 경우)
          if (!['cancelled', 'refunded'].includes(order.status)) {
            await restoreStock(order.items)
          }
          break
      }
    }

    // 배송 정보 업데이트
    if (trackingCompany !== undefined) updateData.trackingCompany = trackingCompany
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber

    // 관리자 메모
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      order: updatedOrder
    })
  } catch (error) {
    console.error('주문 상태 변경 에러:', error)
    return NextResponse.json(
      { error: '주문 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 재고 복구 함수
async function restoreStock(items: { productId: number; optionId: number | null; quantity: number }[]) {
  for (const item of items) {
    if (item.optionId) {
      await prisma.productOption.update({
        where: { id: item.optionId },
        data: {
          stock: { increment: item.quantity }
        }
      })
    }
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        soldCount: { decrement: item.quantity }
      }
    })
  }
}
