'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

const DIFFICULTIES = ['', 'beginner', 'intermediate', 'advanced'] as const
const TYPES = ['', 'plugin', 'widget', 'plugin_with_widget'] as const

const DIFF_KEYS: Record<string, string> = {
  '': 'filterAll',
  beginner: 'filterBeginner',
  intermediate: 'filterIntermediate',
  advanced: 'filterAdvanced',
}

const TYPE_KEYS: Record<string, string> = {
  '': 'filterAll',
  plugin: 'filterPlugin',
  widget: 'filterWidget',
  plugin_with_widget: 'filterPluginWidget',
}

export function RecipeFilter() {
  const t = useTranslations('vibe-coding-recipes')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentDifficulty = searchParams.get('difficulty') || ''
  const currentType = searchParams.get('type') || ''

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium self-center mr-1">{t('difficulty')}:</span>
        {DIFFICULTIES.map((d) => (
          <Button
            key={d || 'all-diff'}
            variant={currentDifficulty === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('difficulty', d)}
          >
            {t(DIFF_KEYS[d])}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium self-center mr-1">{t('type')}:</span>
        {TYPES.map((tp) => (
          <Button
            key={tp || 'all-type'}
            variant={currentType === tp ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('type', tp)}
          >
            {t(TYPE_KEYS[tp])}
          </Button>
        ))}
      </div>
    </div>
  )
}
