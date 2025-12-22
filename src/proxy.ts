import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // NextAuth 세션 토큰 쿠키를 세션 쿠키로 변환
  // (Max-Age/Expires 제거하여 브라우저 종료 시 삭제되도록)
  const sessionToken = request.cookies.get("next-auth.session-token");

  if (sessionToken) {
    // 기존 쿠키를 세션 쿠키로 재설정 (Max-Age 없이)
    response.cookies.set({
      name: "next-auth.session-token",
      value: sessionToken.value,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      // maxAge 생략 = 세션 쿠키 (브라우저 종료 시 삭제)
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files
     *
     * API 라우트도 포함하여 소셜 로그인 콜백에서 설정되는 쿠키도 처리
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
