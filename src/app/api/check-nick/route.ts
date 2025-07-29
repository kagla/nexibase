import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nick } = body;

    if (!nick) {
      return NextResponse.json(
        { error: '닉네임이 필요합니다.' },
        { status: 400 }
      );
    }

    // 닉네임 형식 검증 (2자 이상)
    if (nick.length < 2) {
      return NextResponse.json(
        { error: '닉네임은 2자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 데이터베이스에서 닉네임 중복 확인
    const existingMember = await prisma.g5Member.findFirst({
      where: {
        mb_nick: nick
      },
      select: {
        mb_nick: true,
        mb_name: false,
      }
    });

    const isNickTaken = !!existingMember;

    return NextResponse.json({
      available: !isNickTaken,
      message: isNickTaken 
        ? '이미 사용중인 닉네임입니다.' 
        : '사용 가능한 닉네임입니다.'
    });

  } catch (error) {
    console.error('닉네임 확인 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 