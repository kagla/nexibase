import { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters"
import { prisma } from "./prisma"

// User ID를 Int로 사용하는 커스텀 Prisma Adapter
export function CustomPrismaAdapter(): Adapter {
  return {
    // 사용자 생성 (소셜 로그인 시 새 사용자)
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      const nickname = user.name || `user_${Date.now()}`

      // 닉네임 중복 확인
      let finalNickname = nickname
      let counter = 1
      while (await prisma.user.findFirst({ where: { nickname: finalNickname } })) {
        finalNickname = `${nickname}_${counter}`
        counter++
      }

      const created = await prisma.user.create({
        data: {
          email: user.email,
          nickname: finalNickname,
          image: user.image,
          emailVerified: user.emailVerified,
          level: 1,
        },
      })

      return {
        id: String(created.id),
        email: created.email,
        emailVerified: created.emailVerified,
        name: created.nickname,
        image: created.image,
      }
    },

    // 사용자 조회 (ID로)
    async getUser(id: string): Promise<AdapterUser | null> {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(id) },
      })

      if (!user) return null

      return {
        id: String(user.id),
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.nickname,
        image: user.image,
      }
    },

    // 사용자 조회 (이메일로)
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) return null

      return {
        id: String(user.id),
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.nickname,
        image: user.image,
      }
    },

    // 사용자 조회 (Account로)
    async getUserByAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<AdapterUser | null> {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      })

      if (!account) return null

      const user = account.user
      return {
        id: String(user.id),
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.nickname,
        image: user.image,
      }
    },

    // 사용자 업데이트
    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      const updated = await prisma.user.update({
        where: { id: parseInt(user.id) },
        data: {
          nickname: user.name ?? undefined,
          email: user.email ?? undefined,
          image: user.image ?? undefined,
          emailVerified: user.emailVerified ?? undefined,
        },
      })

      return {
        id: String(updated.id),
        email: updated.email,
        emailVerified: updated.emailVerified,
        name: updated.nickname,
        image: updated.image,
      }
    },

    // 사용자 삭제
    async deleteUser(userId: string): Promise<void> {
      await prisma.user.delete({
        where: { id: parseInt(userId) },
      })
    },

    // Account 연결 (소셜 로그인 연동)
    async linkAccount(account: AdapterAccount): Promise<void> {
      await prisma.account.create({
        data: {
          userId: parseInt(account.userId),
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state as string | undefined,
        },
      })
    },

    // Account 연결 해제
    async unlinkAccount({ providerAccountId, provider }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<void> {
      await prisma.account.delete({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
      })
    },

    // 세션 생성
    async createSession({ sessionToken, userId, expires }: { sessionToken: string; userId: string; expires: Date }) {
      const session = await prisma.session.create({
        data: {
          sessionToken,
          userId: parseInt(userId),
          expires,
        },
      })

      return {
        sessionToken: session.sessionToken,
        userId: String(session.userId),
        expires: session.expires,
      }
    },

    // 세션 조회 (토큰으로)
    async getSessionAndUser(sessionToken: string) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })

      if (!session) return null

      // 탈퇴한 사용자는 세션 무효화
      if (session.user.status === 'withdrawn') {
        await prisma.session.delete({ where: { sessionToken } })
        return null
      }

      return {
        session: {
          sessionToken: session.sessionToken,
          userId: String(session.userId),
          expires: session.expires,
        },
        user: {
          id: String(session.user.id),
          email: session.user.email,
          emailVerified: session.user.emailVerified,
          name: session.user.nickname,
          image: session.user.image,
        },
      }
    },

    // 세션 업데이트
    async updateSession({ sessionToken, expires }: { sessionToken: string; expires?: Date }) {
      const session = await prisma.session.update({
        where: { sessionToken },
        data: { expires },
      })

      return {
        sessionToken: session.sessionToken,
        userId: String(session.userId),
        expires: session.expires,
      }
    },

    // 세션 삭제
    async deleteSession(sessionToken: string): Promise<void> {
      await prisma.session.delete({
        where: { sessionToken },
      }).catch(() => {
        // 세션이 이미 삭제된 경우 무시
      })
    },

    // 이메일 인증 토큰 생성 (사용 안함)
    async createVerificationToken(token: { identifier: string; token: string; expires: Date }) {
      return token
    },

    // 이메일 인증 토큰 사용 (사용 안함)
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      return null
    },
  }
}
