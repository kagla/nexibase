import { prisma } from '@/lib/prisma'
import { pluginWithdrawalPolicies } from './_generated-policies'
import type { WithdrawalPolicyEntry } from './types'

export interface StaleFinding {
  userId: number
  plugin: string
  model: string
  count: number
}

function prismaAccessor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function userField(entry: WithdrawalPolicyEntry): string {
  return ('field' in entry && entry.field) ? entry.field : 'userId'
}

export async function runVerificationSweep(sinceDays = 30): Promise<StaleFinding[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const completed = await prisma.withdrawalJob.findMany({
    where: { status: 'done', completedAt: { gt: since } },
    select: { userId: true },
    distinct: ['userId'],
  })

  const findings: StaleFinding[] = []
  for (const { userId } of completed) {
    for (const [plugin, entries] of Object.entries(pluginWithdrawalPolicies)) {
      for (const entry of entries) {
        if (entry.policy !== 'delete') continue
        const accessor = prismaAccessor(entry.model)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (prisma as any)[accessor]
        if (!client || typeof client.count !== 'function') continue
        const field = userField(entry)
        let count = 0
        try {
          count = await client.count({ where: { [field]: userId } })
        } catch {
          continue  // field doesn't exist — skip
        }
        if (count > 0) findings.push({ userId, plugin, model: entry.model, count })
      }
    }
  }
  return findings
}
