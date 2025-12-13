import cuid from 'cuid'

/**
 * CUID (Collision-resistant Unique Identifier) 생성
 *
 * 특징:
 * - 25자 소문자 문자열 (예: cly7x2k0a0000...)
 * - URL 친화적
 * - 충돌 확률 매우 낮음
 * - 분산 시스템에 적합
 *
 * 정렬: createdAt 필드를 사용해야 함
 *
 * 사용법:
 * const id = generateId()
 * await prisma.user.create({ data: { id, email: '...' } })
 */
export function generateId(): string {
  return cuid()
}
