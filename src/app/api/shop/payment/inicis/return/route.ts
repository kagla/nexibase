import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// SHA256 해시 생성
function sha256(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// IDC별 승인 URL 가져오기
function getAuthUrl(idcName: string): string {
  const baseUrl = 'stdpay.inicis.com/api/payAuth'
  switch (idcName) {
    case 'fc':
      return `https://fc${baseUrl}`
    case 'ks':
      return `https://ks${baseUrl}`
    case 'stg':
      return `https://stg${baseUrl}`
    default:
      return `https://stg${baseUrl}` // 기본값은 테스트 서버
  }
}

// IDC별 망취소 URL 가져오기
function getNetCancelUrl(idcName: string): string {
  const baseUrl = 'stdpay.inicis.com/api/netCancel'
  switch (idcName) {
    case 'fc':
      return `https://fc${baseUrl}`
    case 'ks':
      return `https://ks${baseUrl}`
    case 'stg':
      return `https://stg${baseUrl}`
    default:
      return `https://stg${baseUrl}`
  }
}

// 결제 승인 결과 처리 (POST)
export async function POST(request: NextRequest) {
  // request에서 호스트 정보를 가져와 baseUrl 생성
  const host = request.headers.get('host') || 'localhost:3004'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = process.env.NEXT_PUBLIC_URL || `${protocol}://${host}`

  // 리다이렉트 헬퍼 함수 (303: POST → GET 변환)
  const redirectTo = (path: string) => {
    const url = new URL(path, baseUrl)
    return NextResponse.redirect(url.toString(), 303)
  }

  try {
    // form-urlencoded 데이터 파싱
    const formData = await request.formData()
    const body: Record<string, string> = {}
    formData.forEach((value, key) => {
      body[key] = value.toString()
    })

    const resultCode = body.resultCode
    const resultMsg = body.resultMsg

    // 인증 실패인 경우
    if (resultCode !== '0000') {
      console.error('이니시스 인증 실패:', resultCode, resultMsg)

      // 주문 취소 처리
      const oid = body.orderNumber || body.MOID
      if (oid) {
        await prisma.order.updateMany({
          where: { orderNo: oid },
          data: {
            status: 'cancelled',
            cancelReason: `결제 인증 실패: ${resultMsg}`,
            cancelledAt: new Date()
          }
        })
      }

      // 에러 페이지로 리다이렉트
      return redirectTo(`/shop/order/complete?error=payment_failed&message=${encodeURIComponent(resultMsg || '결제 인증에 실패했습니다.')}`)
    }

    // 인증 성공 - 승인 요청
    const settings = await getShopSettings()
    const signKey = settings.pg_signkey || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS'

    const mid = body.mid
    const authToken = body.authToken
    const authUrl = body.authUrl
    const netCancelUrl = body.netCancelUrl
    const idcName = body.idc_name || 'stg'
    const timestamp = Date.now().toString()

    // 승인 요청용 서명 생성
    const signature = sha256(`authToken=${authToken}&timestamp=${timestamp}`)
    const verification = sha256(`authToken=${authToken}&signKey=${signKey}&timestamp=${timestamp}`)

    // 승인 요청 데이터
    const authData = new URLSearchParams({
      mid,
      authToken,
      timestamp,
      signature,
      verification,
      charset: 'UTF-8',
      format: 'JSON'
    })

    // IDC URL 검증
    const expectedAuthUrl = getAuthUrl(idcName)
    if (authUrl !== expectedAuthUrl) {
      console.warn('인증 URL 불일치:', authUrl, expectedAuthUrl)
    }

    // 승인 요청
    const authResponse = await fetch(expectedAuthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: authData.toString()
    })

    const authResult = await authResponse.json()
    console.log('이니시스 승인 결과:', authResult)

    // 승인 성공
    if (authResult.resultCode === '0000') {
      const orderNo = authResult.MOID
      const tid = authResult.tid
      const totPrice = authResult.TotPrice

      // 주문 상태 업데이트
      const order = await prisma.order.findUnique({
        where: { orderNo },
        include: { items: true }
      })

      if (order) {
        // 결제 금액 검증
        if (parseInt(totPrice) !== order.finalPrice) {
          console.error('결제 금액 불일치:', totPrice, order.finalPrice)

          // 망취소 요청
          const netCancelData = new URLSearchParams({
            mid,
            authToken,
            timestamp,
            signature,
            verification,
            charset: 'UTF-8',
            format: 'JSON'
          })

          const expectedNetCancelUrl = getNetCancelUrl(idcName)
          await fetch(expectedNetCancelUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: netCancelData.toString()
          })

          return redirectTo(`/shop/order/complete?error=amount_mismatch&message=${encodeURIComponent('결제 금액이 일치하지 않습니다.')}`)
        }

        // 주문 상태를 결제 완료로 업데이트
        await prisma.order.update({
          where: { orderNo },
          data: {
            status: 'paid',
            paymentMethod: 'card',
            paymentInfo: JSON.stringify({
              tid,
              cardName: authResult.CARD_BankCode,
              cardNo: authResult.CARD_Num,
              cardQuota: authResult.CARD_Quota,
              applNum: authResult.applNum,
              applDate: authResult.applDate,
              applTime: authResult.applTime
            }),
            paidAt: new Date()
          }
        })

        // 재고 차감 및 판매 수량 증가
        for (const item of order.items) {
          if (item.optionId) {
            await prisma.productOption.update({
              where: { id: item.optionId },
              data: {
                stock: { decrement: item.quantity }
              }
            })
          }
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              soldCount: { increment: item.quantity }
            }
          })
        }

        // 장바구니 비우기는 클라이언트에서 처리
      }

      // 주문 완료 페이지로 리다이렉트
      return redirectTo(`/shop/order/complete?orderNo=${orderNo}`)
    } else {
      // 승인 실패
      console.error('이니시스 승인 실패:', authResult)

      const orderNo = body.orderNumber || body.MOID
      if (orderNo) {
        await prisma.order.updateMany({
          where: { orderNo },
          data: {
            status: 'cancelled',
            cancelReason: `결제 승인 실패: ${authResult.resultMsg}`,
            cancelledAt: new Date()
          }
        })
      }

      return redirectTo(`/shop/order/complete?error=approval_failed&message=${encodeURIComponent(authResult.resultMsg || '결제 승인에 실패했습니다.')}`)
    }
  } catch (error) {
    console.error('결제 처리 에러:', error)
    return redirectTo(`/shop/order/complete?error=server_error&message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다.')}`)
  }
}
