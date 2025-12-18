import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 알림 목록 조회
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where = {
      userId: session.id,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.id, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('알림 조회 에러:', error);
    return NextResponse.json({ error: '알림 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 알림 읽음 처리
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // 모든 알림 읽음 처리
      await prisma.notification.updateMany({
        where: { userId: session.id, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ message: '모든 알림을 읽음 처리했습니다.' });
    }

    if (notificationId) {
      // 특정 알림 읽음 처리
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: session.id },
        data: { isRead: true },
      });
      return NextResponse.json({ message: '알림을 읽음 처리했습니다.' });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('알림 읽음 처리 에러:', error);
    return NextResponse.json({ error: '알림 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 알림 삭제
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // 모든 알림 삭제
      await prisma.notification.deleteMany({
        where: { userId: session.id },
      });
      return NextResponse.json({ message: '모든 알림을 삭제했습니다.' });
    }

    if (notificationId) {
      // 특정 알림 삭제
      await prisma.notification.deleteMany({
        where: { id: parseInt(notificationId), userId: session.id },
      });
      return NextResponse.json({ message: '알림을 삭제했습니다.' });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('알림 삭제 에러:', error);
    return NextResponse.json({ error: '알림 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
