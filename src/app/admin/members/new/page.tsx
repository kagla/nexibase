"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, UserPlus, User, Mail, Phone, MapPin, Shield, Settings, Lock, Home, FileText, Calendar } from "lucide-react"
import { MemberCreateForm } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

export default function NewMemberPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [idChecking, setIdChecking] = useState(false)
  const [idStatus, setIdStatus] = useState<{
    available: boolean | null
    message: string
    checked: boolean
  }>({
    available: null,
    message: "",
    checked: false
  })
  
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
    mb_point: 0,
    mb_homepage: "",
    mb_zip: "",
    mb_addr1: "",
    mb_addr2: "",
    mb_addr3: "",
    mb_signature: "",
    mb_memo: "",
    mb_profile: "",
    mb_icon: "",
    mb_leave_date: "",
    mb_intercept_date: "",
    mb_1: "",
    mb_2: "",
    mb_3: "",
    mb_4: "",
    mb_5: "",
    mb_6: "",
    mb_7: "",
    mb_8: "",
    mb_9: "",
    mb_10: ""
  })

  // 아이디 유효성 검사
  const validateId = (id: string) => {
    if (!id.trim()) {
      return { valid: false, message: "아이디를 입력해주세요." }
    }
    if (id.length < 3) {
      return { valid: false, message: "아이디는 3자 이상이어야 합니다." }
    }
    if (!/^[a-zA-Z0-9_]+$/.test(id)) {
      return { valid: false, message: "아이디는 영문, 숫자, 언더스코어만 사용 가능합니다." }
    }
    return { valid: true, message: "" }
  }

  // 디바운스된 아이디 중복 체크 함수
  const debouncedCheckId = useCallback(
    debounce(async (id: string) => {
      const idValidation = validateId(id)
      if (!idValidation.valid) {
        setIdStatus({
          available: false,
          message: idValidation.message,
          checked: false
        })
        return
      }

      setIdChecking(true)
      try {
        const response = await fetch('/api/admin/members/check-id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mb_id: id }),
        })

        const data = await response.json()

        if (response.ok) {
          setIdStatus({
            available: data.available,
            message: data.message,
            checked: true
          })
        } else {
          setIdStatus({
            available: false,
            message: data.error || '중복 확인 중 오류가 발생했습니다.',
            checked: false
          })
        }
      } catch (error) {
        console.error('아이디 중복 확인 에러:', error)
        setIdStatus({
          available: false,
          message: '네트워크 오류가 발생했습니다.',
          checked: false
        })
      } finally {
        setIdChecking(false)
      }
    }, 500),
    []
  )

  // 아이디 변경 시 자동 중복 체크
  useEffect(() => {
    if (formData.mb_id.trim()) {
      debouncedCheckId(formData.mb_id)
    } else {
      setIdStatus({
        available: null,
        message: "",
        checked: false
      })
    }
  }, [formData.mb_id, debouncedCheckId])

  const handleInputChange = (field: keyof MemberCreateForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 아이디 유효성 검사
    const idValidation = validateId(formData.mb_id)
    if (!idValidation.valid) {
      alert(idValidation.message)
      return
    }

    // 아이디 중복 체크 확인
    if (!idStatus.checked || !idStatus.available) {
      alert("사용할 수 없는 아이디입니다.")
      return
    }

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
    <div className="min-h-screen bg-white">
      <div className="flex">
        <Sidebar activeMenu="members" onMenuChange={() => {}} />
        <main className="flex-1 lg:ml-0 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleCancel} className="text-sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  목록
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">회원 추가</h1>
                  <p className="text-sm text-gray-600 mt-1">새로운 회원 정보를 입력해주세요</p>
                </div>
              </div>
              <Button 
                onClick={handleSubmit}
                disabled={loading || !validateId(formData.mb_id).valid || !idStatus.checked || !idStatus.available}
                className="bg-red-600 hover:bg-red-700 text-sm"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? "저장 중..." : "회원 추가"}
              </Button>
            </div>

            {/* 1. 기본 계정 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-5 w-5 text-blue-600" />
                  기본 계정 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 아이디 / 비밀번호 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mb_id" className="text-xs font-medium">아이디 *</Label>
                    <Input
                      id="mb_id"
                      value={formData.mb_id}
                      onChange={(e) => handleInputChange('mb_id', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                    {formData.mb_id && (
                      <div className={`text-xs ${
                        idStatus.available === true ? 'text-green-600' : 
                        idStatus.available === false ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {idChecking && "확인 중..."}
                        {!idChecking && idStatus.message}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mb_password" className="text-xs font-medium">비밀번호 *</Label>
                    <Input
                      id="mb_password"
                      type="password"
                      value={formData.mb_password}
                      onChange={(e) => handleInputChange('mb_password', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 이름 / 닉네임 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mb_name" className="text-xs font-medium">이름(실명) *</Label>
                    <Input
                      id="mb_name"
                      value={formData.mb_name}
                      onChange={(e) => handleInputChange('mb_name', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mb_nick" className="text-xs font-medium">닉네임</Label>
                    <Input
                      id="mb_nick"
                      value={formData.mb_nick}
                      onChange={(e) => handleInputChange('mb_nick', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 회원 권한 / 포인트 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mb_level" className="text-xs font-medium">회원 권한</Label>
                    <select
                      id="mb_level"
                      value={formData.mb_level}
                      onChange={(e) => handleInputChange('mb_level', parseInt(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm"
                    >
                      <option value={1}>일반회원</option>
                      <option value={2}>우수회원</option>
                      <option value={5}>특별회원</option>
                      <option value={10}>관리자</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">포인트</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={formData.mb_point}
                        onChange={(e) => handleInputChange('mb_point', parseInt(e.target.value) || 0)}
                        type="number"
                        className="text-sm"
                      />
                      <span className="text-xs text-gray-500">점</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. 연락처 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5 text-green-600" />
                  연락처 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* E-mail / 홈페이지 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mb_email" className="text-xs font-medium">E-mail</Label>
                    <Input
                      id="mb_email"
                      type="email"
                      value={formData.mb_email}
                      onChange={(e) => handleInputChange('mb_email', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mb_homepage" className="text-xs font-medium">홈페이지</Label>
                    <Input
                      id="mb_homepage"
                      value={formData.mb_homepage}
                      onChange={(e) => handleInputChange('mb_homepage', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 휴대폰번호 / 전화번호 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mb_hp" className="text-xs font-medium">휴대폰번호</Label>
                    <Input
                      id="mb_hp"
                      value={formData.mb_hp}
                      onChange={(e) => handleInputChange('mb_hp', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mb_tel" className="text-xs font-medium">전화번호</Label>
                    <Input
                      id="mb_tel"
                      value={formData.mb_tel}
                      onChange={(e) => handleInputChange('mb_tel', e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. 주소 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-orange-600" />
                  주소 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={formData.mb_zip}
                    onChange={(e) => handleInputChange('mb_zip', e.target.value)}
                    placeholder="우편번호"
                    className="flex-1 text-sm"
                    autoComplete="off"
                  />
                  <Button type="button" variant="outline" size="sm" className="text-sm">
                    주소 검색
                  </Button>
                </div>
                <Input
                  value={formData.mb_addr1}
                  onChange={(e) => handleInputChange('mb_addr1', e.target.value)}
                  placeholder="기본주소"
                  autoComplete="off"
                  className="text-sm"
                />
                <Input
                  value={formData.mb_addr2}
                  onChange={(e) => handleInputChange('mb_addr2', e.target.value)}
                  placeholder="상세주소"
                  autoComplete="off"
                  className="text-sm"
                />
                <Input
                  value={formData.mb_addr3}
                  onChange={(e) => handleInputChange('mb_addr3', e.target.value)}
                  placeholder="참고항목"
                  autoComplete="off"
                  className="text-sm"
                />
              </CardContent>
            </Card>

            {/* 4. 인증 및 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                  인증 및 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 본인확인방법 / 성인인증 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">본인확인방법</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input type="radio" name="certify_method" value="simple" className="mr-2" />
                        <span className="text-xs">간편인증</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="certify_method" value="phone" checked className="mr-2" />
                        <span className="text-xs">휴대폰</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="certify_method" value="ipin" className="mr-2" />
                        <span className="text-xs">아이핀</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">성인인증</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input type="radio" name="adult" value="yes" className="mr-2" />
                        <span className="text-xs">예</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="adult" value="no" checked className="mr-2" />
                        <span className="text-xs">아니오</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 본인확인 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">본인확인</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input type="radio" name="certify" value="yes" className="mr-2" />
                      <span className="text-xs">예</span>
                    </label>
                    <label className="flex items-center">
                      <input type="radio" name="certify" value="no" checked className="mr-2" />
                      <span className="text-xs">아니오</span>
                    </label>
                  </div>
                </div>

                {/* 메일 수신 / SMS 수신 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">메일 수신</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="mailling"
                          value="1"
                          checked={formData.mb_mailling === 1}
                          onChange={(e) => handleInputChange('mb_mailling', parseInt(e.target.value))}
                          className="mr-2"
                        />
                        <span className="text-xs">예</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="mailling"
                          value="0"
                          checked={formData.mb_mailling === 0}
                          onChange={(e) => handleInputChange('mb_mailling', parseInt(e.target.value))}
                          className="mr-2"
                        />
                        <span className="text-xs">아니오</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">SMS 수신</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sms"
                          value="1"
                          checked={formData.mb_sms === 1}
                          onChange={(e) => handleInputChange('mb_sms', parseInt(e.target.value))}
                          className="mr-2"
                        />
                        <span className="text-xs">예</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sms"
                          value="0"
                          checked={formData.mb_sms === 0}
                          onChange={(e) => handleInputChange('mb_sms', parseInt(e.target.value))}
                          className="mr-2"
                        />
                        <span className="text-xs">아니오</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 정보 공개 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">정보 공개</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="open"
                        value="1"
                        checked={formData.mb_open === 1}
                        onChange={(e) => handleInputChange('mb_open', parseInt(e.target.value))}
                        className="mr-2"
                      />
                      <span className="text-xs">예</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="open"
                        value="0"
                        checked={formData.mb_open === 0}
                        onChange={(e) => handleInputChange('mb_open', parseInt(e.target.value))}
                        className="mr-2"
                      />
                      <span className="text-xs">아니오</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5. 파일 업로드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  파일 업로드
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">회원아이콘</Label>
                    <p className="text-xs text-gray-500">이미지 크기는 넓이 22픽셀 높이 22픽셀로 해주세요.</p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="text-sm">
                        파일 선택
                      </Button>
                      <span className="text-xs text-gray-500">선택된 파일 없음</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">회원이미지</Label>
                    <p className="text-xs text-gray-500">이미지 크기는 넓이 60픽셀 높이 60픽셀로 해주세요.</p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="text-sm">
                        파일 선택
                      </Button>
                      <span className="text-xs text-gray-500">선택된 파일 없음</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 6. 추가 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-gray-600" />
                  추가 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 서명 */}
                <div className="space-y-2">
                  <Label htmlFor="mb_signature" className="text-xs font-medium">서명</Label>
                  <Textarea
                    id="mb_signature"
                    value={formData.mb_signature}
                    onChange={(e) => handleInputChange('mb_signature', e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                {/* 자기 소개 */}
                <div className="space-y-2">
                  <Label htmlFor="mb_profile" className="text-xs font-medium">자기 소개</Label>
                  <Textarea
                    id="mb_profile"
                    value={formData.mb_profile}
                    onChange={(e) => handleInputChange('mb_profile', e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                {/* 메모 */}
                <div className="space-y-2">
                  <Label htmlFor="mb_memo" className="text-xs font-medium">메모</Label>
                  <Textarea
                    id="mb_memo"
                    value={formData.mb_memo}
                    onChange={(e) => handleInputChange('mb_memo', e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                {/* 여분 필드 1 */}
                <div className="space-y-2">
                  <Label htmlFor="mb_1" className="text-xs font-medium">여분 필드 1</Label>
                  <Input
                    id="mb_1"
                    value={formData.mb_1}
                    onChange={(e) => handleInputChange('mb_1', e.target.value)}
                    autoComplete="off"
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 7. 관리 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-red-600" />
                  관리 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 본인인증 내역 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">본인인증 내역</Label>
                  <p className="text-xs text-gray-500">본인인증 내역이 없습니다.</p>
                </div>

                {/* 탈퇴일자 */}
                <div className="space-y-2">
                  <Label htmlFor="mb_leave_date" className="text-xs font-medium">탈퇴일자</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="mb_leave_date"
                      value={formData.mb_leave_date}
                      onChange={(e) => handleInputChange('mb_leave_date', e.target.value)}
                      placeholder="YYYY-MM-DD"
                      autoComplete="off"
                      className="text-sm"
                    />
                    <label className="flex items-center text-xs">
                      <input type="checkbox" className="mr-1" />
                      탈퇴일을 오늘로 지정
                    </label>
                  </div>
                </div>

                {/* 접근차단일자 */}
                <div className="space-y-2">
                  <Label htmlFor="mb_intercept_date" className="text-xs font-medium">접근차단일자</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="mb_intercept_date"
                      value={formData.mb_intercept_date}
                      onChange={(e) => handleInputChange('mb_intercept_date', e.target.value)}
                      placeholder="YYYY-MM-DD"
                      autoComplete="off"
                      className="text-sm"
                    />
                    <label className="flex items-center text-xs">
                      <input type="checkbox" className="mr-1" />
                      접근차단일을 오늘로 지정
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 하단 액션 버튼 */}
            <div className="flex justify-center gap-4 pt-6">
              <Button variant="outline" onClick={handleCancel} size="lg" className="text-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={loading || !validateId(formData.mb_id).valid || !idStatus.checked || !idStatus.available}
                className="bg-red-600 hover:bg-red-700 text-sm"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? "저장 중..." : "회원 추가"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// 디바운스 유틸리티 함수
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
} 