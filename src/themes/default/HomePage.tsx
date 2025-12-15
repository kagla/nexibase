"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, FileText, MessageSquare, Eye } from "lucide-react"
import Link from "next/link"
import { Header, Footer } from "@/themes"

interface UserInfo {
  id: string
  email: string
  name: string | null
  nickname: string | null
  image: string | null
  phone: string | null
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
}

interface SiteSettings {
  site_name: string
  site_description: string
}

interface Board {
  id: number
  slug: string
  name: string
  description: string | null
  postCount: number
}

interface Stats {
  memberCount: number
  boardCount: number
  postCount: number
  commentCount: number
}

interface RecentPost {
  id: number
  title: string
  createdAt: string
  viewCount: number
  author: {
    nickname: string | null
    name: string | null
  }
  board: {
    slug: string
    name: string
  }
}

export default function HomePage() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: 'NexiBase',
    site_description: ''
  })
  const [boards, setBoards] = useState<Board[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 병렬로 데이터 가져오기
        const [userRes, settingsRes, boardsRes, statsRes, postsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=6'),
          fetch('/api/stats'),
          fetch('/api/posts/recent?limit=5')
        ])

        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          setSettings({
            site_name: settingsData.settings.site_name || 'NexiBase',
            site_description: settingsData.settings.site_description || ''
          })
        }

        if (boardsRes.ok) {
          const boardsData = await boardsRes.json()
          setBoards(boardsData.boards || [])
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData.stats)
        }

        if (postsRes.ok) {
          const postsData = await postsRes.json()
          setRecentPosts(postsData.posts || [])
        }
      } catch (error) {
        console.error('데이터 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // 시간 포맷팅
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            {user
              ? `${user.nickname || user.name || '사용자'}님, 환영합니다!`
              : `${settings.site_name}에 오신 것을 환영합니다!`
            }
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            {settings.site_description || '함께 성장하는 커뮤니티'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {boards.length > 0 && (
              <Link href={`/board/${boards[0].slug}`}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  게시판 가기
                </Button>
              </Link>
            )}
            <Link href="/content/about">
              <Button size="lg" variant="outline">
                더 알아보기
              </Button>
            </Link>
          </div>
        </div>

        {/* 통계 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.memberCount}</div>
                  <div className="text-xs text-muted-foreground">회원</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.postCount}</div>
                  <div className="text-xs text-muted-foreground">게시글</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.commentCount}</div>
                  <div className="text-xs text-muted-foreground">댓글</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Eye className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.boardCount}</div>
                  <div className="text-xs text-muted-foreground">게시판</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 게시판 목록 */}
          <div className="lg:col-span-2">
            {boards.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold">게시판</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {boards.map((board) => (
                    <Link key={board.id} href={`/board/${board.slug}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{board.name}</h4>
                            <Badge variant="secondary" className="text-xs">{board.postCount}</Badge>
                          </div>
                          {board.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {board.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 게시판이 없을 때 안내 */}
            {!isLoading && boards.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">아직 게시판이 없습니다</h3>
                  <p className="text-muted-foreground mb-4">
                    관리자 페이지에서 게시판을 생성해 주세요.
                  </p>
                  {user?.role === 'admin' && (
                    <Link href="/admin/boards">
                      <Button>게시판 관리하기</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* 최근 게시글 */}
          <div className="lg:col-span-1">
            {recentPosts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold">최근 글</h3>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {recentPosts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/board/${post.board.slug}/${post.id}`}
                        className="block p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="text-sm font-medium line-clamp-1 mb-1">
                          {post.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{post.author.nickname || post.author.name}</span>
                          <span>·</span>
                          <span>{formatTimeAgo(post.createdAt)}</span>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
