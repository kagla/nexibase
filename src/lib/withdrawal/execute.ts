import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export interface WithdrawalInput {
  userId: number
  reasonCode?: string | null
  reasonText?: string | null
}

/**
 * Phase 1: synchronous anonymization. Runs inside a single transaction.
 * After this returns, the User's personal info is destroyed, their OAuth
 * accounts are unlinked, and a withdrawal_jobs row exists for Phase 2.
 */
export async function executeWithdrawalPhase1(input: WithdrawalInput): Promise<{ jobId: number }> {
  const { userId, reasonCode, reasonText } = input
  const token = crypto.randomBytes(8).toString('hex').slice(0, 12)        // stable random per withdrawal
  const anonEmail = `deleted_${token}@deleted.local`
  const anonNickname = `탈퇴한회원_${token.slice(0, 6)}`

  return await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        nickname: anonNickname,
        name: null,
        phone: null,
        image: null,
        password: null,
        provider: null,
        providerId: null,
        emailVerified: null,
        lastLoginIp: null,
        status: 'withdrawn',
        deletedAt: new Date(),
      },
    })
    await tx.account.deleteMany({ where: { userId } })
    const job = await tx.withdrawalJob.create({
      data: {
        userId,
        status: 'pending',
        reasonCode: reasonCode || null,
        reasonText: reasonText || null,
      },
    })
    return { jobId: job.id }
  })
}
