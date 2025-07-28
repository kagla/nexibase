import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 필수 필드 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 1. 이메일(아이디)로 사용자 검색
    const user = await prisma.g5Member.findFirst({
      where: { 
        mb_email: email.toLowerCase() 
      },
      select: {
        mb_no: true,
        mb_id: true,
        mb_email: true,
        mb_password: true,
        mb_nick: true,
        mb_level: true,
        mb_email_certify: true,
        mb_datetime: true
      }
    });

    // 사용자가 존재하지 않음
    if (!user) {
      return NextResponse.json(
        { error: '등록되지 않은 이메일입니다.' },
        { status: 401 }
      );
    }

    // 2. 비밀번호 확인
    const isPasswordValid = verifyPassword(password, user.mb_password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 3. 이메일 인증 확인 (mb_email_certify가 1980년 이후인지 확인)
    const certifyDate = new Date(user.mb_email_certify);
    const limitDate = new Date('1980-01-01');
    
    // 위 2개의 시간 보여줘
    console.log('certifyDate:', certifyDate);
    console.log('limitDate:', limitDate);
    if (certifyDate <= limitDate) {
      return NextResponse.json(
        { 
          error: '이메일 인증이 필요합니다. 이메일을 확인해주세요.',
          requireEmailVerification: true 
        },
        { status: 403 }
      );
    }

    // 로그인 성공 - 오늘 로그인 시간 업데이트
    await prisma.g5Member.update({
      where: { mb_no: user.mb_no },
      data: { mb_today_login: new Date() }
    });

    // 클라이언트 IP 주소 가져오기
    const clientIP = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';

    // 성공 응답 (민감한 정보 제외)
    return NextResponse.json({
      success: true,
      message: '로그인이 완료되었습니다.',
      user: {
        mb_no: user.mb_no,
        mb_id: user.mb_id,
        mb_email: user.mb_email,
        mb_nick: user.mb_nick,
        mb_level: user.mb_level,
        loginTime: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error) {
    console.error('로그인 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 