import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../../../../.env') })

import { PrismaClient } from '@prisma/client'
import { resolveSlot } from './slot-resolver'
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder'
import { callClaude } from './claude-client'
import { parseClaudeResponse, validateRecipe, validateRecipeCompleteness, ensureUniqueSlug } from './recipe-validator'

async function main() {
  if (process.env.VIBE_RECIPES_ENABLED !== 'true') {
    console.log('[vibe-recipes] Disabled via VIBE_RECIPES_ENABLED. Exiting.')
    return
  }

  const prisma = new PrismaClient()

  try {
    const overrides = parseCliOverrides()
    const slot = await resolveSlot(prisma, overrides)

    console.log(`[vibe-recipes] Slot ${slot.slot}: ${slot.difficulty} / ${slot.type}`)

    const log = await prisma.vibeRecipeGenerationLog.create({
      data: {
        status: 'running',
        difficulty: slot.difficulty,
        type: slot.type,
        slot: slot.slot,
      },
    })

    try {
      const existingRecipes = await prisma.vibeRecipe.findMany({
        orderBy: { generatedAt: 'desc' },
        take: 100,
        select: { titleEn: true, slug: true },
      })

      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt(slot, existingRecipes)

      console.log('[vibe-recipes] Calling Claude...')
      const response = await callClaude(systemPrompt, userPrompt)

      console.log(`[vibe-recipes] Received ${response.outputTokens} output tokens`)

      const parsed = parseClaudeResponse(response.text)
      const validated = validateRecipe(parsed)
      validateRecipeCompleteness(validated)
      const uniqueSlug = await ensureUniqueSlug(prisma, validated.slug)

      const model = process.env.VIBE_RECIPES_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

      const recipe = await prisma.vibeRecipe.create({
        data: {
          slug: uniqueSlug,
          difficulty: validated.difficulty,
          type: validated.type,
          titleEn: validated.titleEn,
          titleKo: validated.titleKo,
          descriptionEn: validated.descriptionEn,
          descriptionKo: validated.descriptionKo,
          constraintsEn: validated.constraintsEn,
          constraintsKo: validated.constraintsKo,
          stepsEn: validated.stepsEn,
          stepsKo: validated.stepsKo,
          model,
        },
      })

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          recipeId: recipe.id,
          tokensUsed: response.inputTokens + response.outputTokens,
        },
      })

      console.log(`[vibe-recipes] Created recipe #${recipe.id}: "${recipe.titleEn}" (${uniqueSlug})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[vibe-recipes] Generation failed: ${msg}`)

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: msg.slice(0, 2000),
        },
      })
    }
  } finally {
    await prisma.$disconnect()
  }
}

function parseCliOverrides(): {
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  type?: 'plugin' | 'widget' | 'plugin_with_widget'
} {
  const args = process.argv.slice(2)
  const overrides: Record<string, string> = {}
  for (const arg of args) {
    const [key, val] = arg.replace(/^--/, '').split('=')
    if (key && val) overrides[key] = val
  }
  return {
    difficulty: overrides.difficulty as 'beginner' | 'intermediate' | 'advanced' | undefined,
    type: overrides.type as 'plugin' | 'widget' | 'plugin_with_widget' | undefined,
  }
}

main().catch((err) => {
  console.error('[vibe-recipes] Fatal error:', err)
  process.exit(1)
})
