import { nanoid } from 'nanoid'

/**
 * NanoID 생성 (기본 알파벳: A-Za-z0-9_-)
 *
 * 특징:
 * - 21자 URL-safe 문자열
 * - cuid보다 작고 빠름
 * - 충돌 확률 매우 낮음
 *
 * 사용법:
 * const id = generateId()
 * await prisma.user.create({ data: { id, email: '...' } })
 */
export function generateId(): string {
  return nanoid()
}
