"use client"

import Link from "next/link"
import { Settings } from "lucide-react"
import { useSite } from "@/lib/SiteContext"

export function AdminPageEditButton({ pageId }: { pageId: number }) {
  const { user } = useSite()

  if (!user || user.role !== 'admin') return null

  return (
    <Link
      href={`/admin/pages/${pageId}`}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      title="Edit this page"
    >
      <Settings className="h-5 w-5" />
    </Link>
  )
}
