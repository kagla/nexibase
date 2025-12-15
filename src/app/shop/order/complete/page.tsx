"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  CheckCircle2,
  Package,
  Building2,
  CreditCard,
  Copy,
  Check,
} from "lucide-react"

interface Order {
  orderNo: string
  ordererName: string
  ordererPhone: string
  recipientName: string
  recipientPhone: string
  zipCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
  totalPrice: number
  deliveryFee: number
  finalPrice: number
  paymentMethod: string
  status: string
  createdAt: string
  items: {
    id: number
    productName: string
    optionText: string | null
    price: number
    quantity: number
    subtotal: number
    productImage: string | null
    productSlug: string | null
  }[]
}

interface ShopSettings {
  shop_name: string
  shop_tel: string
  bank_info: string
  delivery_notice: string
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    }>
      <OrderCompleteContent />
    </Suspense>
  )
}

function OrderCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderNo = searchParams.get("orderNo")

  const [order, setOrder] = useState<Order | null>(null)
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!orderNo) {
      router.push("/shop")
      return
    }
    loadOrder()
    loadShopSettings()
  }, [orderNo])

  const loadOrder = async () => {
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`)
      if (!res.ok) {
        setError("주문 정보를 불러올 수 없습니다.")
        return
      }
      const data = await res.json()
      setOrder(data.order)
    } catch (err) {
      setError("주문 정보를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const loadShopSettings = async () => {
    try {
      const res = await fetch("/api/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setShopSettings(data.settings)
      }
    } catch (err) {
      console.error("설정 로드 에러:", err)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatPrice = (price: number) => price.toLocaleString() + "원"
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <p className="text-muted-foreground mb-4">{error || "주문 정보를 찾을 수 없습니다."}</p>
          <Button onClick={() => router.push("/shop")}>쇼핑몰로 이동</Button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* 완료 메시지 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">주문이 완료되었습니다</h1>
            <p className="text-muted-foreground">
              주문번호: <span className="font-mono font-medium">{order.orderNo}</span>
              <button
                onClick={() => copyToClipboard(order.orderNo)}
                className="ml-2 inline-flex items-center"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(order.createdAt)}
            </p>
          </div>

          {/* 결제 안내 */}
          {order.paymentMethod === "bank" && order.status === "pending" && shopSettings?.bank_info && (
            <Card className="mb-6 border-primary">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  입금 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="whitespace-pre-wrap text-sm mb-4">
                  {shopSettings.bank_info}
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">결제 금액:</span>{" "}
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(order.finalPrice)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    입금 확인 후 주문이 처리됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {order.paymentMethod === "card" && order.status === "pending" && (
            <Card className="mb-6 border-primary">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  카드 결제
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm mb-4">
                  카드 결제를 진행해주세요.
                </p>
                <Button className="w-full" size="lg">
                  {formatPrice(order.finalPrice)} 결제하기
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  결제 창으로 이동합니다.
                </p>
              </CardContent>
            </Card>
          )}

          {/* 주문 상품 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">주문 상품</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                  <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.productSlug ? (
                      <Link href={`/shop/${item.productSlug}`} className="hover:text-primary">
                        <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                      </Link>
                    ) : (
                      <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                    )}
                    {item.optionText && (
                      <p className="text-sm text-muted-foreground">{item.optionText}</p>
                    )}
                    <p className="text-sm">
                      {formatPrice(item.price)} × {item.quantity}개
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 배송지 정보 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">배송지 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-20 text-muted-foreground">받는 분</span>
                <span>{order.recipientName}</span>
              </div>
              <div className="flex">
                <span className="w-20 text-muted-foreground">연락처</span>
                <span>{order.recipientPhone}</span>
              </div>
              <div className="flex">
                <span className="w-20 text-muted-foreground">주소</span>
                <span>
                  [{order.zipCode}] {order.address}
                  {order.addressDetail && ` ${order.addressDetail}`}
                </span>
              </div>
              {order.deliveryMemo && (
                <div className="flex">
                  <span className="w-20 text-muted-foreground">배송 메모</span>
                  <span>{order.deliveryMemo}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 결제 정보 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">결제 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">상품 금액</span>
                <span>{formatPrice(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">배송비</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">총 결제금액</span>
                <span className="text-lg font-bold text-primary">
                  {formatPrice(order.finalPrice)}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-muted-foreground">결제 방법</span>
                <span>
                  {order.paymentMethod === "bank" ? "무통장입금" : "카드결제"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 버튼 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/shop")}
            >
              쇼핑 계속하기
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push("/shop/orders")}
            >
              주문 내역 확인
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
