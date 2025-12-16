"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header, Footer } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Trash2,
} from "lucide-react"

interface WishlistItem {
  id: number
  productId: number
  productName: string
  productSlug: string
  price: number
  originPrice: number | null
  image: string | null
  isActive: boolean
  isSoldOut: boolean
  createdAt: string
}

export default function WishlistPage() {
  const router = useRouter()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const fetchWishlist = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shop/wishlist?page=${page}&limit=12`)
      if (res.status === 401) {
        router.push('/login?redirect=/shop/wishlist')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('찜 목록 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [page, router])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  // 찜 해제
  const removeFromWishlist = async (productId: number) => {
    setRemovingId(productId)
    try {
      const res = await fetch(`/api/shop/wishlist?productId=${productId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setItems(items.filter(item => item.productId !== productId))
      }
    } catch (error) {
      console.error('찜 해제 에러:', error)
    } finally {
      setRemovingId(null)
    }
  }

  // 장바구니에 추가
  const addToCart = async (item: WishlistItem) => {
    try {
      const res = await fetch('/api/shop/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          quantity: 1
        })
      })
      if (res.ok) {
        alert('장바구니에 추가되었습니다.')
      } else {
        const data = await res.json()
        alert(data.error || '장바구니 추가에 실패했습니다.')
      }
    } catch {
      alert('장바구니 추가에 실패했습니다.')
    }
  }

  // 썸네일 URL 생성
  const getThumbnailUrl = (url: string | null) => {
    if (!url) return '/placeholder.png'
    if (url.includes('imagedelivery.net') && !url.includes('/public')) {
      return url.replace(/\/[^/]+$/, '/w=200')
    }
    return url
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                찜 목록
              </CardTitle>
              <Link href="/shop">
                <Button variant="outline" size="sm">
                  쇼핑 계속하기
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">찜한 상품이 없습니다.</p>
                <Link href="/shop">
                  <Button>쇼핑하러 가기</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((item) => (
                    <div key={item.id} className="group relative border rounded-lg overflow-hidden">
                      {/* 상품 이미지 */}
                      <Link href={`/shop/${item.productSlug}`}>
                        <div className="aspect-square relative bg-muted">
                          <img
                            src={getThumbnailUrl(item.image)}
                            alt={item.productName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {/* 품절 오버레이 */}
                          {(item.isSoldOut || !item.isActive) && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Badge variant="secondary" className="text-sm">
                                {!item.isActive ? "판매중지" : "품절"}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* 찜 해제 버튼 */}
                      <button
                        onClick={() => removeFromWishlist(item.productId)}
                        disabled={removingId === item.productId}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
                        title="찜 해제"
                      >
                        {removingId === item.productId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                        )}
                      </button>

                      {/* 상품 정보 */}
                      <div className="p-3">
                        <Link href={`/shop/${item.productSlug}`}>
                          <h3 className="text-sm font-medium line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                            {item.productName}
                          </h3>
                        </Link>
                        <div className="flex items-baseline gap-1 mb-3">
                          {item.originPrice && item.originPrice > item.price && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(item.originPrice)}
                            </span>
                          )}
                          <span className="text-sm font-bold text-primary">
                            {formatPrice(item.price)}
                          </span>
                        </div>

                        {/* 장바구니 버튼 */}
                        {item.isActive && !item.isSoldOut && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => addToCart(item)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            장바구니
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      이전
                    </Button>
                    <span className="flex items-center px-4 text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      다음
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}
