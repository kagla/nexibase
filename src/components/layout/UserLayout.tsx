"use client"

import { useState, useEffect } from "react"
import { getLayoutComponent } from "@/lib/layout-loader"

interface UserLayoutProps {
  children: React.ReactNode
}

export function UserLayout({ children }: UserLayoutProps) {
  const [layoutFolder, setLayoutFolder] = useState('default')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.settings?.layout_folder) {
          setLayoutFolder(data.settings.layout_folder)
        }
      })
      .catch(() => {})
  }, [])

  const HeaderComponent = getLayoutComponent(layoutFolder, 'Header')
  const FooterComponent = getLayoutComponent(layoutFolder, 'Footer')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderComponent />
      <main className="flex-1">{children}</main>
      <FooterComponent />
    </div>
  )
}
