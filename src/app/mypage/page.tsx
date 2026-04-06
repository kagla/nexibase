"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { UserLayout } from "@/components/layout/UserLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  User, Bell, LogOut, Pencil,
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
  const [pluginMenus, setPluginMenus] = useState<{ label: string, icon: string, path: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.ok ? r.json() : null),
      fetch('/api/admin/plugins').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([userData, pluginsData]) => {
      if (userData?.user) {
        setUser(userData.user)
      } else {
        router.push('/login')
      }

      if (pluginsData?.plugins) {
        const menus: { label: string, icon: string, path: string }[] = []
        for (const p of pluginsData.plugins as PluginWithMenus[]) {
          if (p.enabled && p.myPageMenus?.length > 0) {
            for (const m of p.myPageMenus) {
              menus.push({
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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {user.image ? (
                  <img src={user.image} alt={user.nickname} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{user.nickname}</h1>
                  {user.role === 'admin' && <Badge>관리자</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.name && <p className="text-sm text-muted-foreground">{user.name} {user.phone && `/ ${user.phone}`}</p>}
              </div>
              <Link href="/mypage/profile/edit">
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-1" />
                  프로필 수정
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 바로가기 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/mypage/profile/edit" className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">프로필 수정</span>
          </Link>
          {pluginMenus.map((menu, idx) => {
            const Icon = iconMap[menu.icon] || User
            return (
              <a key={idx} href={menu.path} className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs">{menu.label}</span>
              </a>
            )
          })}
          <Link href="/mypage?tab=notifications" className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">알림</span>
          </Link>
        </div>

        {/* 로그아웃 */}
        <Button variant="outline" onClick={handleLogout} className="w-full text-red-500">
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </UserLayout>
  )
}
