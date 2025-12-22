"use client"

import { useEffect } from "react"
import { signOut, useSession } from "next-auth/react"

// 브라우저 세션 ID 키
const SESSION_KEY = "browser-session-id"

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession()

  useEffect(() => {
    // 로그인 상태인데 sessionStorage에 세션 ID가 없으면 = 브라우저 재시작
    if (status === "authenticated") {
      const currentSessionId = sessionStorage.getItem(SESSION_KEY)

      if (!currentSessionId) {
        // 브라우저 재시작으로 판단 = 로그아웃 후 새로고침
        signOut({ redirect: false }).then(() => {
          window.location.reload()
        })
      }
    }
  }, [status])

  return <>{children}</>
}

// 로그인 성공 시 호출하는 함수
export function markJustLoggedIn() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, crypto.randomUUID())
  }
}

// 로그아웃 시 호출하는 함수
export function clearBrowserSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY)
  }
}
