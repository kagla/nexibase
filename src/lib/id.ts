import { v7 as uuidv7 } from 'uuid'

/**
 * UUID v7 생성
 *
 * 특징:
 * - 36자 표준 UUID 형식 (하이픈 포함)
 * - 시간 기반 정렬 가능 (타임스탬프 내장)
 * - DB 인덱싱에 유리
 * - 충돌 확률 매우 낮음
 *
 * 사용법:
 * const id = generateId()
 * await prisma.user.create({ data: { id, email: '...' } })
 */
export function generateId(): string {
  return uuidv7()
}
