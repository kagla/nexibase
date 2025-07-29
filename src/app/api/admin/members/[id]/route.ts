import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePBKDF2Hash } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mb_id = params.id
    const body = await request.json()
    const {
      mb_name,
      mb_nick,
      mb_email,
      mb_password,
      mb_level,
      mb_certify,
      mb_adult,
      mb_mailling,
      mb_sms,
      mb_open,
      mb_point,
      mb_hp,
      mb_tel
    } = body

    // 필수 필드 검증
    if (!mb_name || !mb_nick || !mb_email) {
      return NextResponse.json(
        { error: '필수 필드를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // 회원 존재 확인
    const existingMember = await prisma.g5Member.findFirst({
      where: { mb_id },
      select: { mb_id: true, mb_email: true, mb_nick: true }
    })

    if (!existingMember) {
      return NextResponse.json(
        { error: '존재하지 않는 회원입니다.' },
        { status: 404 }
      )
    }

    // 이메일 중복 확인 (자신 제외)
    if (mb_email !== existingMember.mb_email) {
      const existingEmail = await prisma.g5Member.findFirst({
        where: { 
          mb_email: mb_email.toLowerCase(),
          mb_id: { not: mb_id }
        },
        select: { mb_email: true }
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: '이미 사용 중인 이메일입니다.' },
          { status: 409 }
        )
      }
    }

    // 닉네임 중복 확인 (자신 제외)
    if (mb_nick !== existingMember.mb_nick) {
      const existingNickname = await prisma.g5Member.findFirst({
        where: { 
          mb_nick,
          mb_id: { not: mb_id }
        },
        select: { mb_nick: true }
      })

      if (existingNickname) {
        return NextResponse.json(
          { error: '이미 사용 중인 닉네임입니다.' },
          { status: 409 }
        )
      }
    }

    // 업데이트 데이터 준비
    const updateData: any = {
      mb_name,
      mb_nick,
      mb_email: mb_email.toLowerCase(),
      mb_level: mb_level || 2,
      mb_certify: mb_certify || '',
      mb_adult: mb_adult || 0,
      mb_mailling: mb_mailling || 0,
      mb_sms: mb_sms || 0,
      mb_open: mb_open || 0,
      mb_point: mb_point || 0,
      mb_hp: mb_hp || '',
      mb_tel: mb_tel || ''
    }

    // 비밀번호가 제공된 경우 해시화하여 추가
    if (mb_password) {
      updateData.mb_password = generatePBKDF2Hash(mb_password)
    }

    // 회원 정보 업데이트
    const updatedMember = await prisma.g5Member.update({
      where: { mb_id },
      data: updateData,
      select: {
        mb_no: true,
        mb_id: true,
        mb_name: true,
        mb_nick: true,
        mb_email: true,
        mb_level: true,
        mb_datetime: true
      }
    })

    return NextResponse.json({
      success: true,
      message: '회원 정보가 성공적으로 수정되었습니다.',
      member: updatedMember
    })

  } catch (error) {
    console.error('회원 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mb_id = params.id

    const member = await prisma.g5Member.findFirst({
      where: { mb_id },
      select: {
        mb_no: true,
        mb_id: true,
        mb_name: true,
        mb_nick: true,
        mb_email: true,
        mb_level: true,
        mb_certify: true,
        mb_adult: true,
        mb_mailling: true,
        mb_sms: true,
        mb_open: true,
        mb_point: true,
        mb_hp: true,
        mb_tel: true,
        mb_leave_date: true,
        mb_intercept_date: true,
        mb_email_certify: true
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: '존재하지 않는 회원입니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      member
    })

  } catch (error) {
    console.error('회원 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 