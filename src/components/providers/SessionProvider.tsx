"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}

// 로그인 성공 시 호출할 함수 (현재는 사용하지 않지만 호환성 유지)
export function markBrowserSession() {
  // 프록시에서 세션 쿠키로 변환하므로 별도 처리 불필요
}

// 소셜 로그인 전 호출 (현재는 사용하지 않지만 호환성 유지)
export function markJustLoggedIn() {
  // 프록시에서 세션 쿠키로 변환하므로 별도 처리 불필요
}

// 로그아웃 시 호출할 함수 (현재는 사용하지 않지만 호환성 유지)
export function clearBrowserSession() {
  // 프록시에서 세션 쿠키로 변환하므로 별도 처리 불필요
}
