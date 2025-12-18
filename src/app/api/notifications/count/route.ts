import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 읽지 않은 알림 개수만 조회 (Header용 경량 API)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.notification.count({
      where: { userId: session.id, isRead: false, deletedAt: null },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('알림 개수 조회 에러:', error);
    return NextResponse.json({ count: 0 });
  }
}
