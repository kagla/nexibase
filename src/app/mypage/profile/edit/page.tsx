"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, User } from "lucide-react"

interface UserInfo {
  id: number
  email: string
  nickname: string
  name: string | null
  phone: string | null
  image: string | null
}

export default function EditProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [nickname, setNickname] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user)
          setNickname(data.user.nickname || '')
          setName(data.user.name || '')
          setPhone(data.user.phone || '')
        } else {
          router.push('/login')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, name, phone }),
      })
      if (res.ok) {
        setMessage('저장되었습니다.')
        const data = await res.json()
        if (data.user) setUser(data.user)
      } else {
        const data = await res.json()
        setMessage(data.error || '저장 실패')
      }
    } catch {
      setMessage('서버 오류')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <MyPageLayout>
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      </MyPageLayout>
    )
  }

  if (!user) return null

  return (
    <MyPageLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/mypage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">프로필 수정</h1>
        </div>

        {message && (
          <div className="px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">{message}</div>
        )}

        {/* 프로필 이미지 */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {user.image ? (
              <img src={user.image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <User className="h-12 w-12 text-primary" />
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>닉네임</Label>
              <Input value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
            <div>
              <Label>이름</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="실명" />
            </div>
            <div>
              <Label>연락처</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div>
              <Label>이메일</Label>
              <Input value={user.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">이메일은 변경할 수 없습니다</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MyPageLayout>
  )
}
