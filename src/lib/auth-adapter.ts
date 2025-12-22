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

    // JWT 전략 사용으로 세션 관련 함수는 사용하지 않음
    // 하지만 Adapter 인터페이스 호환성을 위해 빈 구현 유지
    async createSession() {
      return { sessionToken: "", userId: "", expires: new Date() }
    },

    async getSessionAndUser() {
      return null
    },

    async updateSession() {
      return { sessionToken: "", userId: "", expires: new Date() }
    },

    async deleteSession() {},

    // 이메일 인증 토큰 (사용 안함)
    async createVerificationToken(token: { identifier: string; token: string; expires: Date }) {
      return token
    },

    async useVerificationToken() {
      return null
    },
  }
}
