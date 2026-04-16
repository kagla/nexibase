import { PrismaClient } from '@prisma/client'

export interface SlotResult {
  slot: 1 | 2 | 3
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  type: 'plugin' | 'widget' | 'plugin_with_widget'
}

const SCHEDULE: Record<string, ('beginner' | 'intermediate' | 'advanced')[]> = {
  mon: ['beginner', 'beginner', 'advanced'],
  thu: ['beginner', 'beginner', 'advanced'],
  _default: ['beginner', 'beginner', 'intermediate'],
}

const DAY_MAP: Record<number, string> = {
  0: '_default', // Sun
  1: 'mon',
  2: '_default', // Tue
  3: '_default', // Wed
  4: 'thu',
  5: '_default', // Fri
  6: '_default', // Sat
}

const HOUR_TO_SLOT: Record<number, 1 | 2 | 3> = {
  9: 1,
  14: 2,
  20: 3,
}

export async function resolveSlot(
  prisma: PrismaClient,
  overrides?: { difficulty?: SlotResult['difficulty']; type?: SlotResult['type'] }
): Promise<SlotResult> {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()

  const slot = HOUR_TO_SLOT[hour] ?? inferSlotFromHour(hour)
  const dayKey = DAY_MAP[dayOfWeek] ?? '_default'
  const schedule = SCHEDULE[dayKey] ?? SCHEDULE['_default']

  const difficulty = overrides?.difficulty ?? schedule[slot - 1]

  let type: SlotResult['type']
  if (overrides?.type) {
    type = overrides.type
  } else if (difficulty === 'advanced') {
    type = 'plugin_with_widget'
  } else if (difficulty === 'intermediate') {
    type = 'plugin'
  } else {
    type = await getNextBeginnerType(prisma)
  }

  return { slot, difficulty, type }
}

function inferSlotFromHour(hour: number): 1 | 2 | 3 {
  if (hour < 12) return 1
  if (hour < 17) return 2
  return 3
}

async function getNextBeginnerType(
  prisma: PrismaClient
): Promise<'plugin' | 'widget'> {
  const last = await prisma.vibeRecipe.findFirst({
    where: { difficulty: 'beginner' },
    orderBy: { generatedAt: 'desc' },
    select: { type: true },
  })
  return last?.type === 'plugin' ? 'widget' : 'plugin'
}
