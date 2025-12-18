import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 주소록 목록 조회
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const addresses = await prisma.userAddress.findMany({
      where: { userId: session.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('주소록 조회 에러:', error);
    return NextResponse.json({ error: '주소록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 주소 추가
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, recipientName, recipientPhone, zipCode, address, addressDetail, isDefault } = body;

    // 유효성 검사
    if (!name || !recipientName || !recipientPhone || !zipCode || !address) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId: session.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // 첫 번째 주소는 자동으로 기본 배송지로 설정
    const existingCount = await prisma.userAddress.count({
      where: { userId: session.id },
    });

    const newAddress = await prisma.userAddress.create({
      data: {
        userId: session.id,
        name,
        recipientName,
        recipientPhone,
        zipCode,
        address,
        addressDetail: addressDetail || null,
        isDefault: isDefault || existingCount === 0,
      },
    });

    return NextResponse.json({ address: newAddress, message: '주소가 추가되었습니다.' });
  } catch (error) {
    console.error('주소 추가 에러:', error);
    return NextResponse.json({ error: '주소 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
