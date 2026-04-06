"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { UserLayout } from "@/components/layout/UserLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  User, Bell, LogOut,
  ClipboardList, Heart, MapPin, Gavel, ShoppingBag, Package,
  FileText, ScrollText, MessageSquare, Settings,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  ClipboardList, Heart, MapPin, Gavel, ShoppingBag, Package,
  FileText, ScrollText, MessageSquare, Settings, Bell, User,
}

interface UserInfo {
  id: number
  email: string
  nickname: string
  name: string | null
  phone: string | null
  image: string | null
  role: string
}

interface MyPageMenu {
  label: string
  icon: string
  subPath: string
}

interface PluginWithMenus {
  folder: string
  name: string
  currentSlug: string
  enabled: boolean
  myPageMenus: MyPageMenu[]
}

export default function MyPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [nickname, setNickname] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pluginMenus, setPluginMenus] = useState<{ slug: string, label: string, icon: string, path: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/plugins').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([userData, pluginsData]) => {
      if (userData?.user) {
        setUser(userData.user)
        setNickname(userData.user.nickname || '')
        setName(userData.user.name || '')
        setPhone(userData.user.phone || '')
      } else {
        router.push('/login')
      }

      // 활성 플러그인의 myPageMenus 수집
      if (pluginsData?.plugins) {
        const menus: { slug: string, label: string, icon: string, path: string }[] = []
        for (const p of pluginsData.plugins as PluginWithMenus[]) {
          if (p.enabled && p.myPageMenus?.length > 0) {
            for (const m of p.myPageMenus) {
              menus.push({
                slug: p.currentSlug,
                label: m.label,
                icon: m.icon,
                path: `/${p.currentSlug}${m.subPath}`,
              })
            }
          }
        }
        setPluginMenus(menus)
      }
    }).finally(() => setLoading(false))
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

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <UserLayout>
        <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
      </UserLayout>
    )
  }

  if (!user) return null

  return (
    <UserLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 프로필 헤더 */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {user.image ? (
              <img src={user.image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{user.nickname}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.role === 'admin' && <Badge className="mt-1">관리자</Badge>}
          </div>
        </div>

        {message && (
          <div className="px-4 py-2 bg-primary/10 text-primary rounded-md text-sm">{message}</div>
        )}

        {/* 바로가기 — 플러그인에서 동적으로 */}
        {pluginMenus.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pluginMenus.map((menu, idx) => {
              const Icon = iconMap[menu.icon] || User
              return (
                <a key={idx} href={menu.path} className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs">{menu.label}</span>
                </a>
              )
            })}
          </div>
        )}

        {/* 프로필 수정 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">프로필 수정</CardTitle>
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
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? '저장 중...' : '저장'}
            </Button>
          </CardContent>
        </Card>

        {/* 로그아웃 */}
        <Button variant="outline" onClick={handleLogout} className="w-full text-red-500">
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </UserLayout>
  )
}
