import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RecipeCardProps {
  slug: string
  title: string
  description: string
  difficulty: string
  type: string
  generatedAt: string
  locale: string
}

const DIFF_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
}

const TYPE_COLORS: Record<string, string> = {
  plugin: 'bg-blue-100 text-blue-800',
  widget: 'bg-purple-100 text-purple-800',
  plugin_with_widget: 'bg-indigo-100 text-indigo-800',
}

export function RecipeCard({
  slug,
  title,
  description,
  difficulty,
  type,
  generatedAt,
  locale,
}: RecipeCardProps) {
  const plainDesc = description.replace(/[#*`_\[\]]/g, '').slice(0, 120)
  const relativeTime = getRelativeTime(generatedAt, locale)
  const typeLabel = type.replace(/_/g, ' ')

  return (
    <Link href={`/${locale}/vibe-coding-recipes/${slug}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="secondary" className={DIFF_COLORS[difficulty]}>
              {difficulty}
            </Badge>
            <Badge variant="secondary" className={TYPE_COLORS[type]}>
              {typeLabel}
            </Badge>
          </div>
          <CardTitle className="text-base leading-snug line-clamp-2">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">{plainDesc}</p>
          <p className="text-xs text-muted-foreground mt-3">{relativeTime}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function getRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return locale === 'ko' ? '오늘' : 'Today'
  if (diffDays === 1) return locale === 'ko' ? '어제' : 'Yesterday'
  if (diffDays < 7) return locale === 'ko' ? `${diffDays}일 전` : `${diffDays}d ago`
  if (diffDays < 30) return locale === 'ko' ? `${Math.floor(diffDays / 7)}주 전` : `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
}
