"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, UserPlus } from "lucide-react"
import { MemberCreateForm } from "@/lib/types"

export default function NewMemberPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<MemberCreateForm>({
    mb_id: "",
    mb_password: "",
    mb_password_confirm: "",
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

  const handleInputChange = (field: keyof MemberCreateForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 비밀번호 확인
    if (formData.mb_password !== formData.mb_password_confirm) {
      alert("비밀번호가 일치하지 않습니다.")
      return
    }

    // 필수 필드 검증
    if (!formData.mb_id || !formData.mb_password || !formData.mb_name) {
      alert("필수 항목을 모두 입력해주세요.")
      return
    }

    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        alert('회원이 성공적으로 추가되었습니다.')
        router.push('/admin/members?success=true')
      } else {
        alert(data.error || '회원 추가 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 추가 실패:', error)
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/members')
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
                <h1 className="text-2xl font-bold text-gray-900">회원 추가</h1>
              </div>
            </div>

            {/* 폼 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  새 회원 정보 입력
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-700">기본 정보</h3>
                      
                      <div>
                        <Label htmlFor="mb_id">아이디 *</Label>
                        <Input
                          id="mb_id"
                          value={formData.mb_id}
                          onChange={(e) => handleInputChange('mb_id', e.target.value)}
                          placeholder="회원 아이디"
                          required
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_password">비밀번호 *</Label>
                        <Input
                          id="mb_password"
                          type="password"
                          value={formData.mb_password}
                          onChange={(e) => handleInputChange('mb_password', e.target.value)}
                          placeholder="비밀번호"
                          required
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_password_confirm">비밀번호 확인 *</Label>
                        <Input
                          id="mb_password_confirm"
                          type="password"
                          value={formData.mb_password_confirm}
                          onChange={(e) => handleInputChange('mb_password_confirm', e.target.value)}
                          placeholder="비밀번호 확인"
                          required
                          autoComplete="off"
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
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_nick">닉네임</Label>
                        <Input
                          id="mb_nick"
                          value={formData.mb_nick}
                          onChange={(e) => handleInputChange('mb_nick', e.target.value)}
                          placeholder="닉네임"
                          autoComplete="off"
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
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_hp">휴대폰</Label>
                        <Input
                          id="mb_hp"
                          value={formData.mb_hp}
                          onChange={(e) => handleInputChange('mb_hp', e.target.value)}
                          placeholder="휴대폰 번호"
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_tel">전화번호</Label>
                        <Input
                          id="mb_tel"
                          value={formData.mb_tel}
                          onChange={(e) => handleInputChange('mb_tel', e.target.value)}
                          placeholder="전화번호"
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <Label htmlFor="mb_level">권한 레벨</Label>
                        <select
                          id="mb_level"
                          value={formData.mb_level}
                          onChange={(e) => handleInputChange('mb_level', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          autoComplete="off"
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
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 설정 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700">설정</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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