"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Button } from "@/components/ui/button"
import {
  LogOut,
  ClipboardList, Heart, MapPin, Gavel, Bell, Pencil, User,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  ClipboardList, Heart, MapPin, Gavel, Bell, Pencil, User,
}

interface PluginWithMenus {
  folder: string
  currentSlug: string
  enabled: boolean
  myPageMenus: { label: string, icon: string, subPath: string }[]
}

export default function MyPage() {
  const router = useRouter()
  const [pluginMenus, setPluginMenus] = useState<{ label: string, icon: string, path: string }[]>([])

  useEffect(() => {
    fetch('/api/admin/plugins')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.plugins) {
          const menus: { label: string, icon: string, path: string }[] = []
          for (const p of data.plugins as PluginWithMenus[]) {
            if (p.enabled && p.myPageMenus?.length > 0) {
              for (const m of p.myPageMenus) {
                menus.push({ label: m.label, icon: m.icon, path: `/${p.currentSlug}${m.subPath}` })
              }
            }
          }
          setPluginMenus(menus)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <MyPageLayout>
      <div className="space-y-6">
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
          <Link href="/mypage/notifications" className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
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
    </MyPageLayout>
  )
}
