import { prisma } from '../../src/lib/prisma'
import { executeWithdrawalPhase2 } from '../../src/lib/withdrawal/execute'

const MAX_ATTEMPTS = 5
const ORPHAN_MINUTES = 30

async function main() {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MINUTES * 60 * 1000)
  const candidates = await prisma.withdrawalJob.findMany({
    where: {
      OR: [
        { status: 'failed',  attempts: { lt: MAX_ATTEMPTS } },
        { status: 'pending', attempts: { lt: MAX_ATTEMPTS } },
        { status: 'running', startedAt: { lt: orphanCutoff }, attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: { id: 'asc' },
    take: 50,
  })
  console.log(`[withdrawal-retry] ${candidates.length} job(s) to retry`)
  for (const job of candidates) {
    try {
      await executeWithdrawalPhase2(job.id)
      console.log(`[withdrawal-retry] job ${job.id} → done`)
    } catch (err) {
      console.error(`[withdrawal-retry] job ${job.id} failed:`, err instanceof Error ? err.message : err)
    }
  }
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
