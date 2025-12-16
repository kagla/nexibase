import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// 이니시스 결제 취소 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNo, cancelAmount, cancelReason } = body

    if (!orderNo) {
      return NextResponse.json({ error: '주문번호가 필요합니다.' }, { status: 400 })
    }

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { orderNo }
    })

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 카드 결제가 아니면 취소 불필요
    if (order.paymentMethod !== 'card') {
      return NextResponse.json({
        success: true,
        message: '카드 결제가 아닙니다.',
        needsPGCancel: false
      })
    }

    // 이미 취소된 주문
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json({
        success: true,
        message: '이미 취소된 주문입니다.',
        needsPGCancel: false
      })
    }

    // paymentInfo에서 tid 추출
    let tid: string | null = null
    if (order.paymentInfo) {
      try {
        const paymentData = typeof order.paymentInfo === 'string'
          ? JSON.parse(order.paymentInfo)
          : order.paymentInfo
        tid = paymentData.tid || null
      } catch {
        tid = null
      }
    }

    // 결제 정보가 없으면 취소 불필요
    if (!tid) {
      return NextResponse.json({
        success: true,
        message: '결제 정보가 없습니다.',
        needsPGCancel: false
      })
    }

    // 쇼핑몰 설정 가져오기
    const settings = await getShopSettings()
    const testMode = settings.pg_test_mode !== 'false'
    const mid = testMode ? 'INIpayTest' : (settings.pg_mid || 'INIpayTest')
    const signKey = testMode ? 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS' : (settings.pg_signkey || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS')

    // 취소 금액 (미지정시 전액)
    const amount = cancelAmount || order.totalPrice

    // 이니시스 취소 API 호출
    const cancelResult = await cancelInicisPayment({
      mid,
      signKey,
      tid,
      cancelAmount: amount,
      cancelReason: cancelReason || '고객 요청에 의한 취소',
      partialCancel: amount < order.totalPrice,
      testMode
    })

    if (cancelResult.success) {
      return NextResponse.json({
        success: true,
        message: '결제가 취소되었습니다.',
        needsPGCancel: true,
        cancelResult
      })
    } else {
      return NextResponse.json({
        success: false,
        error: cancelResult.message || '결제 취소에 실패했습니다.',
        cancelResult
      }, { status: 400 })
    }
  } catch (error) {
    console.error('결제 취소 에러:', error)
    return NextResponse.json(
      { error: '결제 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 이니시스 결제 취소 함수
async function cancelInicisPayment({
  mid,
  signKey,
  tid,
  cancelAmount,
  cancelReason,
  partialCancel,
  testMode
}: {
  mid: string
  signKey: string
  tid: string
  cancelAmount: number
  cancelReason: string
  partialCancel: boolean
  testMode: boolean
}) {
  try {
    // 이니시스 취소 API URL
    const cancelUrl = testMode
      ? 'https://iniapi.inicis.com/api/v1/refund'
      : 'https://iniapi.inicis.com/api/v1/refund'

    const timestamp = Date.now().toString()

    // 취소 요청용 해시 생성
    const hashData = `${mid}${tid}${timestamp}${cancelAmount}${signKey}`
    const hashString = crypto.createHash('sha512').update(hashData).digest('hex')

    const requestBody = {
      mid,
      tid,
      type: partialCancel ? 'Partial' : 'FullCancel',
      msg: cancelReason,
      price: cancelAmount.toString(),
      timestamp,
      hashString,
      clientIp: '127.0.0.1'
    }

    console.log('이니시스 취소 요청:', { mid, tid, cancelAmount, partialCancel, testMode })

    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    const result = await response.json()
    console.log('이니시스 취소 응답:', result)

    // 이니시스 응답 코드 확인
    // resultCode가 '00'이면 성공
    if (result.resultCode === '00') {
      return {
        success: true,
        message: '결제 취소 성공',
        data: result
      }
    } else {
      // 테스트 모드에서는 취소 API가 동작하지 않을 수 있음
      // 그 경우 성공으로 처리 (실제 결제가 안되었으므로)
      if (testMode) {
        console.log('테스트 모드: 실제 취소 API 미지원, 성공으로 처리')
        return {
          success: true,
          message: '테스트 모드 - 취소 처리 완료',
          data: result
        }
      }

      return {
        success: false,
        message: result.resultMsg || '결제 취소 실패',
        data: result
      }
    }
  } catch (error) {
    console.error('이니시스 취소 API 호출 에러:', error)

    // 테스트 모드에서 API 오류시에도 성공 처리
    if (testMode) {
      return {
        success: true,
        message: '테스트 모드 - 취소 처리 완료 (API 미지원)',
        data: null
      }
    }

    return {
      success: false,
      message: '결제 취소 API 호출 실패',
      error
    }
  }
}
