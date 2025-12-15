"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Save,
  Settings,
  Building2,
  Truck,
  FileText,
  AlertCircle,
  Check,
} from "lucide-react"

interface ShopSettings {
  shop_name: string
  shop_tel: string
  shop_email: string
  bank_info: string
  delivery_notice: string
  refund_policy: string
  option1_name: string
  option2_name: string
  option3_name: string
}

const DEFAULT_SETTINGS: ShopSettings = {
  shop_name: "",
  shop_tel: "",
  shop_email: "",
  bank_info: "",
  delivery_notice: "",
  refund_policy: "",
  option1_name: "색상",
  option2_name: "사이즈",
  option3_name: "모델",
}

export default function ShopSettingsPage() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
    } catch (err) {
      console.error("설정 로드 에러:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/admin/shop/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "저장에 실패했습니다.")
        return
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: keyof ShopSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            쇼핑몰 설정
          </h1>
          <p className="text-muted-foreground">
            쇼핑몰 기본 정보를 설정합니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              저장
            </>
          )}
        </Button>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-100 text-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-100 text-green-800 rounded-lg">
          <Check className="h-4 w-4" />
          설정이 저장되었습니다.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              기본 정보
            </CardTitle>
            <CardDescription>
              쇼핑몰의 기본 정보를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="shop_name">쇼핑몰 이름</Label>
              <Input
                id="shop_name"
                value={settings.shop_name}
                onChange={(e) => handleChange("shop_name", e.target.value)}
                placeholder="예: 청춘 과수원"
              />
            </div>
            <div>
              <Label htmlFor="shop_tel">연락처</Label>
              <Input
                id="shop_tel"
                value={settings.shop_tel}
                onChange={(e) => handleChange("shop_tel", e.target.value)}
                placeholder="예: 010-1234-5678"
              />
            </div>
            <div>
              <Label htmlFor="shop_email">이메일</Label>
              <Input
                id="shop_email"
                type="email"
                value={settings.shop_email}
                onChange={(e) => handleChange("shop_email", e.target.value)}
                placeholder="예: shop@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* 결제 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              결제 정보
            </CardTitle>
            <CardDescription>
              무통장입금 계좌 정보를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="bank_info">입금 계좌 안내</Label>
              <Textarea
                id="bank_info"
                value={settings.bank_info}
                onChange={(e) => handleChange("bank_info", e.target.value)}
                placeholder="예: 국민은행 123-456-789012 홍길동"
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                주문 완료 시 고객에게 표시됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 배송 안내 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              배송 안내
            </CardTitle>
            <CardDescription>
              배송 관련 안내 문구를 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="delivery_notice">배송 안내 문구</Label>
              <Textarea
                id="delivery_notice"
                value={settings.delivery_notice}
                onChange={(e) => handleChange("delivery_notice", e.target.value)}
                placeholder="예: 주문 후 2-3일 이내 발송됩니다. 제주/도서산간 지역은 추가 배송비가 발생합니다."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* 환불 정책 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              환불 정책
            </CardTitle>
            <CardDescription>
              교환/환불 관련 정책을 입력합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="refund_policy">환불 정책</Label>
              <Textarea
                id="refund_policy"
                value={settings.refund_policy}
                onChange={(e) => handleChange("refund_policy", e.target.value)}
                placeholder="예: 상품 수령 후 7일 이내 환불 가능합니다. 단, 신선식품은 환불이 불가합니다."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* 옵션명 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              옵션명 설정
            </CardTitle>
            <CardDescription>
              상품 옵션의 표시명을 설정합니다. (관리자 화면에서 사용)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="option1_name">1단계 옵션명</Label>
                <Input
                  id="option1_name"
                  value={settings.option1_name}
                  onChange={(e) => handleChange("option1_name", e.target.value)}
                  placeholder="예: 색상"
                />
              </div>
              <div>
                <Label htmlFor="option2_name">2단계 옵션명</Label>
                <Input
                  id="option2_name"
                  value={settings.option2_name}
                  onChange={(e) => handleChange("option2_name", e.target.value)}
                  placeholder="예: 사이즈"
                />
              </div>
              <div>
                <Label htmlFor="option3_name">3단계 옵션명</Label>
                <Input
                  id="option3_name"
                  value={settings.option3_name}
                  onChange={(e) => handleChange("option3_name", e.target.value)}
                  placeholder="예: 모델"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
