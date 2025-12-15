"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, FileText, MessageSquare, TrendingUp, Eye, ThumbsUp, Clock } from "lucide-react"
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
  likeCount?: number
  commentCount?: number
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
        const [userRes, settingsRes, boardsRes, statsRes, postsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=6'),
          fetch('/api/stats'),
          fetch('/api/posts/recent?limit=10')
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 메인 콘텐츠 영역 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 환영 메시지 (로그인 사용자) */}
              {user && (
                <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-sm">
                      안녕하세요, <span className="font-semibold text-primary">{user.nickname || user.name || '사용자'}</span>님! 👋
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 최근 게시글 */}
              <Card>
                <div className="border-b px-4 py-3 flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    최근 게시글
                  </h2>
                  <Link href="/recent" className="text-sm text-primary hover:underline">
                    더보기
                  </Link>
                </div>
                <CardContent className="p-0">
                  {recentPosts.length > 0 ? (
                    <div className="divide-y">
                      {recentPosts.map((post) => (
                        <Link
                          key={post.id}
                          href={`/board/${post.board.slug}/${post.id}`}
                          className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {post.board.name}
                                </Badge>
                                <span className="font-medium text-sm truncate">
                                  {post.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{post.author.nickname || post.author.name}</span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {post.viewCount}
                                </span>
                                {post.likeCount !== undefined && post.likeCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" />
                                    {post.likeCount}
                                  </span>
                                )}
                                {post.commentCount !== undefined && post.commentCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {post.commentCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTimeAgo(post.createdAt)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground">
                      아직 게시글이 없습니다.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 게시판 목록 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    게시판
                  </h2>
                </div>
                {boards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {boards.map((board) => (
                      <Link key={board.id} href={`/board/${board.slug}`}>
                        <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-medium">{board.name}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {board.postCount}
                              </Badge>
                            </div>
                            {board.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {board.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      아직 게시판이 없습니다.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* 사이드바 */}
            <div className="space-y-6">
              {/* 커뮤니티 통계 */}
              {stats && (
                <Card>
                  <div className="border-b px-4 py-3">
                    <h2 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      커뮤니티 현황
                    </h2>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-xl font-bold">{stats.memberCount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">회원</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <FileText className="h-5 w-5 mx-auto mb-1 text-green-500" />
                        <div className="text-xl font-bold">{stats.postCount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">게시글</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <MessageSquare className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                        <div className="text-xl font-bold">{stats.commentCount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">댓글</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <TrendingUp className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                        <div className="text-xl font-bold">{stats.boardCount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">게시판</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 인기 게시판 */}
              {boards.length > 0 && (
                <Card>
                  <div className="border-b px-4 py-3">
                    <h2 className="font-semibold">🔥 인기 게시판</h2>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {boards.slice(0, 5).map((board, index) => (
                        <Link
                          key={board.id}
                          href={`/board/${board.slug}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                            index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm font-medium truncate">{board.name}</span>
                          <span className="text-xs text-muted-foreground">{board.postCount}</span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 커뮤니티 가이드 */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">📌 커뮤니티 가이드</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 서로를 존중하는 대화를 해주세요</li>
                    <li>• 욕설, 비방, 광고는 금지됩니다</li>
                    <li>• 도움이 필요하면 문의하기를 이용하세요</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
