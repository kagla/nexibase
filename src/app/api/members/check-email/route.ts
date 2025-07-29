import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, exclude_id } = body;

    if (!email) {
      return NextResponse.json(
        { error: '이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 데이터베이스에서 이메일 중복 확인 (exclude_id가 있으면 해당 회원 제외)
    const whereCondition: any = {
      mb_email: email.toLowerCase()
    };

    // 수정 모드일 때는 현재 회원을 제외하고 중복 검사
    if (exclude_id) {
      whereCondition.mb_id = {
        not: exclude_id
      };
    }

    const existingMember = await prisma.g5Member.findFirst({
      where: whereCondition,
      select: {
        mb_email: true
      }
    });

    if (existingMember) {
      return NextResponse.json({
        success: false,
        available: false,
        message: '이미 사용 중인 이메일입니다.'
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '사용 가능한 이메일입니다.'
    });

  } catch (error) {
    console.error('이메일 중복 검사 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 