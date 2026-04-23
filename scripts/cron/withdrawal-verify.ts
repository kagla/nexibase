import { prisma } from '../../src/lib/prisma'
import { runVerificationSweep } from '../../src/lib/withdrawal/verify'

async function main() {
  const findings = await runVerificationSweep(30)
  if (findings.length === 0) {
    console.log('[withdrawal-verify] ✓ No stale rows detected')
  } else {
    console.error(`[withdrawal-verify] ✗ ${findings.length} stale reference(s) detected:`)
    for (const f of findings) {
      console.error(`  userId=${f.userId}  ${f.plugin}.${f.model} — ${f.count} row(s) remain (policy=delete, should be 0)`)
    }
  }
  await prisma.$disconnect()
  process.exit(findings.length === 0 ? 0 : 2)
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
