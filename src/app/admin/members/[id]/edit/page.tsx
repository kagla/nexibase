"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, User, AlertCircle } from "lucide-react"
import { Member, MemberUpdateForm } from "@/lib/types"

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string
  
  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [formData, setFormData] = useState<MemberUpdateForm>({
    mb_id: "",
    mb_name: "",
    mb_nick: "",
    mb_email: "",
    mb_hp: "",
    mb_tel: "",
    mb_level: 2,
    mb_certify: "",
    mb_adult: 0,
    mb_mailling: 1,
    mb_sms: 1,
    mb_open: 1,
    mb_point: 0
  })

  // 회원 정보 조회
  useEffect(() => {
    const fetchMember = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/members/${memberId}`)
        const data = await response.json()

        if (data.success) {
          setMember(data.member)
          setFormData({
            mb_id: data.member.mb_id,
            mb_name: data.member.mb_name || "",
            mb_nick: data.member.mb_nick || "",
            mb_email: data.member.mb_email || "",
            mb_hp: data.member.mb_hp || "",
            mb_tel: data.member.mb_tel || "",
            mb_level: data.member.mb_level,
            mb_certify: data.member.mb_certify || "",
            mb_adult: data.member.mb_adult,
            mb_mailling: data.member.mb_mailling,
            mb_sms: data.member.mb_sms,
            mb_open: data.member.mb_open,
            mb_point: data.member.mb_point
          })
        } else {
          alert('회원 정보를 찾을 수 없습니다.')
          router.push('/admin/members')
        }
      } catch (error) {
        console.error('회원 정보 조회 실패:', error)
        alert('회원 정보 조회 중 오류가 발생했습니다.')
        router.push('/admin/members')
      } finally {
        setLoading(false)
      }
    }

    if (memberId) {
      fetchMember()
    }
  }, [memberId, router])

  const handleInputChange = (field: keyof MemberUpdateForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 필드 검증
    if (!formData.mb_id || !formData.mb_name) {
      alert("필수 항목을 모두 입력해주세요.")
      return
    }

    try {
      setLoading(true)
      
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        alert('회원 정보가 성공적으로 수정되었습니다.')
        router.push('/admin/members?success=true')
      } else {
        alert(data.error || '회원 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 수정 실패:', error)
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/members')
  }

  if (loading && !member) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">회원 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">회원을 찾을 수 없습니다.</p>
          <Button onClick={handleCancel} className="mt-4">
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar activeMenu="members" onMenuChange={() => {}} />
        <main className="flex-1 lg:ml-0 p-4">
          <div className="max-w-4xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  목록으로
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">회원 수정</h1>
              </div>
              <div className="text-sm text-gray-500">
                회원 ID: {member.mb_id}
              </div>
            </div>

            {/* 폼 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  회원 정보 수정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700">기본 정보</h3>
                      
                      <div>
                        <Label htmlFor="mb_id">아이디</Label>
                        <Input
                          id="mb_id"
                          value={formData.mb_id}
                          onChange={(e) => handleInputChange('mb_id', e.target.value)}
                          placeholder="회원 아이디"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_name">이름 *</Label>
                        <Input
                          id="mb_name"
                          value={formData.mb_name}
                          onChange={(e) => handleInputChange('mb_name', e.target.value)}
                          placeholder="실명"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_nick">닉네임</Label>
                        <Input
                          id="mb_nick"
                          value={formData.mb_nick}
                          onChange={(e) => handleInputChange('mb_nick', e.target.value)}
                          placeholder="닉네임"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700">연락처 정보</h3>
                      
                      <div>
                        <Label htmlFor="mb_email">이메일</Label>
                        <Input
                          id="mb_email"
                          type="email"
                          value={formData.mb_email}
                          onChange={(e) => handleInputChange('mb_email', e.target.value)}
                          placeholder="이메일 주소"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_hp">휴대폰</Label>
                        <Input
                          id="mb_hp"
                          value={formData.mb_hp}
                          onChange={(e) => handleInputChange('mb_hp', e.target.value)}
                          placeholder="휴대폰 번호"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_tel">전화번호</Label>
                        <Input
                          id="mb_tel"
                          value={formData.mb_tel}
                          onChange={(e) => handleInputChange('mb_tel', e.target.value)}
                          placeholder="전화번호"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 권한 및 설정 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700">권한 및 포인트</h3>
                      
                      <div>
                        <Label htmlFor="mb_level">권한 레벨</Label>
                        <select
                          id="mb_level"
                          value={formData.mb_level}
                          onChange={(e) => handleInputChange('mb_level', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value={1}>일반회원</option>
                          <option value={2}>우수회원</option>
                          <option value={5}>특별회원</option>
                          <option value={10}>관리자</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="mb_point">포인트</Label>
                        <Input
                          id="mb_point"
                          type="number"
                          value={formData.mb_point}
                          onChange={(e) => handleInputChange('mb_point', parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_certify">본인확인</Label>
                        <select
                          id="mb_certify"
                          value={formData.mb_certify}
                          onChange={(e) => handleInputChange('mb_certify', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="">미인증</option>
                          <option value="hp">휴대폰</option>
                          <option value="ipin">아이핀</option>
                          <option value="simple">간편인증</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700">설정</h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="mb_adult"
                            checked={formData.mb_adult === 1}
                            onChange={(e) => handleInputChange('mb_adult', e.target.checked ? 1 : 0)}
                            className="rounded"
                          />
                          <Label htmlFor="mb_adult">성인인증</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="mb_mailling"
                            checked={formData.mb_mailling === 1}
                            onChange={(e) => handleInputChange('mb_mailling', e.target.checked ? 1 : 0)}
                            className="rounded"
                          />
                          <Label htmlFor="mb_mailling">메일수신</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="mb_sms"
                            checked={formData.mb_sms === 1}
                            onChange={(e) => handleInputChange('mb_sms', e.target.checked ? 1 : 0)}
                            className="rounded"
                          />
                          <Label htmlFor="mb_sms">SMS수신</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="mb_open"
                            checked={formData.mb_open === 1}
                            onChange={(e) => handleInputChange('mb_open', e.target.checked ? 1 : 0)}
                            className="rounded"
                          />
                          <Label htmlFor="mb_open">정보공개</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 회원 상태 정보 */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">회원 상태 정보</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">가입일:</span>
                        <div className="font-medium">{member.mb_datetime ? new Date(member.mb_datetime).toLocaleDateString('ko-KR') : '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">최종접속:</span>
                        <div className="font-medium">{member.mb_today_login ? new Date(member.mb_today_login).toLocaleDateString('ko-KR') : '-'}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">이메일인증:</span>
                        <div className="font-medium">
                          {member.mb_email_certify && member.mb_email_certify !== '0000-00-00 00:00:00' ? '인증완료' : '미인증'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">상태:</span>
                        <div className="font-medium">
                          {member.mb_leave_date ? '탈퇴' : member.mb_intercept_date ? '차단' : '정상'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      취소
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          저장
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
} 