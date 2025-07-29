"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Eye, EyeOff } from "lucide-react"

interface Member {
  mb_id: string
  mb_name: string
  mb_nick: string
  mb_email: string
  mb_level: number
  mb_certify: string
  mb_adult: number
  mb_mailling: number
  mb_sms: number
  mb_open: number
  mb_point: number
  mb_hp: string
  mb_tel: string
  // 편집 시에만 필요한 추가 필드들
  mb_no?: number
  mb_leave_date?: string
  mb_intercept_date?: string
  mb_email_certify?: string
}

interface MemberEditModalProps {
  member: Member | null
  isOpen: boolean
  onClose: () => void
  onSave: (member: Member) => void
}

export function MemberEditModal({ member, isOpen, onClose, onSave }: MemberEditModalProps) {
  const [formData, setFormData] = useState<Member>({
    mb_id: '',
    mb_name: '',
    mb_nick: '',
    mb_email: '',
    mb_level: 2,
    mb_certify: '',
    mb_adult: 0,
    mb_mailling: 0,
    mb_sms: 0,
    mb_open: 0,
    mb_point: 0,
    mb_hp: '',
    mb_tel: ''
  })

  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 이메일 중복 검사 상태 추가
  const [emailStatus, setEmailStatus] = useState<{
    available: boolean | null;
    message: string;
    checking: boolean;
  }>({
    available: null,
    message: "",
    checking: false
  })

  // 닉네임 중복 검사 상태 추가
  const [nickStatus, setNickStatus] = useState<{
    available: boolean | null;
    message: string;
    checking: boolean;
  }>({
    available: null,
    message: "",
    checking: false
  })
  
  // 디바운스를 위한 ref
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const nickTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 회원 정보로 폼 초기화
  useEffect(() => {
    if (member && isOpen) {
      setFormData({
        mb_id: member.mb_id,
        mb_name: member.mb_name || '',
        mb_nick: member.mb_nick || '',
        mb_email: member.mb_email || '',
        mb_level: member.mb_level || 2,
        mb_certify: member.mb_certify || '',
        mb_adult: member.mb_adult || 0,
        mb_mailling: member.mb_mailling || 0,
        mb_sms: member.mb_sms || 0,
        mb_open: member.mb_open || 0,
        mb_point: member.mb_point || 0,
        mb_hp: member.mb_hp || '',
        mb_tel: member.mb_tel || '',
        // 편집 시에만 필요한 추가 필드들
        mb_no: member.mb_no,
        mb_leave_date: member.mb_leave_date,
        mb_intercept_date: member.mb_intercept_date,
        mb_email_certify: member.mb_email_certify
      })
      setNewPassword('')
      setErrors({})
      setShowPassword(false)
      // 이메일 상태 초기화
      setEmailStatus({
        available: null,
        message: "",
        checking: false
      })
      // 닉네임 상태 초기화
      setNickStatus({
        available: null,
        message: "",
        checking: false
      })
    }
  }, [member, isOpen])

  // 이메일 형식 검증 함수
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // 이메일 중복 확인 함수
  const checkEmailAvailability = async (emailValue: string) => {
    // 현재 회원의 이메일과 동일하면 중복 검사 불필요
    if (member && emailValue === member.mb_email) {
      setEmailStatus({ 
        available: true, 
        message: "", // 메시지 제거
        checking: false 
      });
      return;
    }

    // 이메일 형식이 유효하지 않으면 중복 확인하지 않음
    if (!emailValue || !isValidEmail(emailValue)) {
      setEmailStatus({ 
        available: null, 
        message: emailValue && !isValidEmail(emailValue) ? "올바른 이메일 형식을 입력하세요" : "", 
        checking: false 
      });
      return;
    }

    setEmailStatus(prev => ({ ...prev, checking: true }));

    try {
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailStatus({
          available: data.available,
          message: data.message,
          checking: false
        });
      } else {
        setEmailStatus({
          available: false,
          message: data.error || '확인 중 오류가 발생했습니다.',
          checking: false
        });
      }
    } catch (error) {
      console.error('이메일 확인 에러:', error);
      setEmailStatus({
        available: false,
        message: '네트워크 오류가 발생했습니다.',
        checking: false
      });
    }
  };

  // 닉네임 중복 확인 함수
  const checkNickAvailability = async (nickValue: string) => {
    // 현재 회원의 닉네임과 동일하면 중복 검사 불필요
    if (member && nickValue === member.mb_nick) {
      setNickStatus({ 
        available: true, 
        message: "", // 메시지 제거
        checking: false 
      });
      return;
    }

    // 닉네임 형식이 유효하지 않으면 중복 확인하지 않음
    if (!nickValue || nickValue.length < 2) {
      setNickStatus({ 
        available: null, 
        message: nickValue && nickValue.length < 2 ? "닉네임은 2자 이상이어야 합니다" : "", 
        checking: false 
      });
      return;
    }

    setNickStatus(prev => ({ ...prev, checking: true }));

    try {
      const response = await fetch('/api/check-nick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nick: nickValue }),
      });

      const data = await response.json();

      if (response.ok) {
        setNickStatus({
          available: data.available,
          message: data.message,
          checking: false
        });
      } else {
        setNickStatus({
          available: false,
          message: data.error || '확인 중 오류가 발생했습니다.',
          checking: false
        });
      }
    } catch (error) {
      console.error('닉네임 확인 에러:', error);
      setNickStatus({
        available: false,
        message: '네트워크 오류가 발생했습니다.',
        checking: false
      });
    }
  };

  // 이메일 입력 핸들러 (디바운스 적용)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setFormData({ ...formData, mb_email: newEmail });
    
    // 기존 타이머가 있다면 클리어
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }
    
    // 새 타이머 설정 (500ms 후 중복 검사)
    emailTimeoutRef.current = setTimeout(() => {
      checkEmailAvailability(newEmail);
    }, 500);
  };

  // 닉네임 입력 핸들러 (디바운스 적용)
  const handleNickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNick = e.target.value;
    setFormData({ ...formData, mb_nick: newNick });
    
    // 기존 타이머가 있다면 클리어
    if (nickTimeoutRef.current) {
      clearTimeout(nickTimeoutRef.current);
    }
    
    // 새 타이머 설정 (500ms 후 중복 검사)
    nickTimeoutRef.current = setTimeout(() => {
      checkNickAvailability(newNick);
    }, 500);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      if (nickTimeoutRef.current) {
        clearTimeout(nickTimeoutRef.current);
      }
    };
  }, []);

  // 유효성 검사
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // 이름 검증
    if (!formData.mb_name.trim()) {
      newErrors.mb_name = '이름을 입력해주세요.'
    }

    // 닉네임 검증
    if (!formData.mb_nick.trim()) {
      newErrors.mb_nick = '닉네임을 입력해주세요.'
    } else if (formData.mb_nick.length < 2) {
      newErrors.mb_nick = '닉네임은 2자 이상이어야 합니다.'
    } else if (nickStatus.available === false) {
      newErrors.mb_nick = '이미 사용 중인 닉네임입니다.'
    } else if (nickStatus.checking) {
      newErrors.mb_nick = '닉네임 중복 확인 중입니다.'
    }

    // 이메일 검증
    if (!formData.mb_email.trim()) {
      newErrors.mb_email = '이메일을 입력해주세요.'
    } else if (!isValidEmail(formData.mb_email)) {
      newErrors.mb_email = '올바른 이메일 형식을 입력해주세요.'
    } else if (emailStatus.available === false) {
      newErrors.mb_email = '이미 사용 중인 이메일입니다.'
    } else if (emailStatus.checking) {
      newErrors.mb_email = '이메일 중복 확인 중입니다.'
    }

    // 새 비밀번호 검증 (입력된 경우에만)
    // if (newPassword && newPassword.length < 6) {
    //   newErrors.newPassword = '새 비밀번호는 6자 이상이어야 합니다.'
    // }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      const updateData = {
        ...formData,
        ...(newPassword && { mb_password: newPassword })
      }
      await onSave(updateData)
      onClose()
    } catch (error) {
      console.error('회원 수정 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  const getStatusText = () => {
    if (formData.mb_leave_date) return "탈퇴"
    if (formData.mb_intercept_date) return "차단"
    return "정상"
  }

  const getStatusColor = () => {
    if (formData.mb_leave_date) return "bg-gray-500"
    if (formData.mb_intercept_date) return "bg-red-500"
    return "bg-green-500"
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">회원 정보 수정</h2>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">기본 정보</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mb_id" className="text-sm font-medium">회원 ID</Label>
                <Input
                  id="mb_id"
                  value={formData.mb_id}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium">새 비밀번호</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={errors.newPassword ? 'border-red-500 pr-10' : 'pr-10'}
                    placeholder="변경하려면 새 비밀번호를 입력하세요"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">비밀번호를 변경하지 않으려면 비워두세요.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mb_name" className="text-sm font-medium">
                  이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mb_name"
                  value={formData.mb_name}
                  onChange={(e) => setFormData({ ...formData, mb_name: e.target.value })}
                  className={errors.mb_name ? 'border-red-500' : ''}
                  placeholder="이름을 입력하세요"
                  disabled={isSubmitting}
                />
                {errors.mb_name && (
                  <p className="text-red-500 text-xs mt-1">{errors.mb_name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="mb_nick" className="text-sm font-medium">
                  닉네임 <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="mb_nick"
                    value={formData.mb_nick}
                    onChange={handleNickChange}
                    className={`${errors.mb_nick ? 'border-red-500' : ''} ${
                      nickStatus.available === false ? 'border-red-500' : 
                      nickStatus.available === true ? 'border-green-500' : ''
                    }`}
                    placeholder="닉네임을 입력하세요"
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                  {nickStatus.checking && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                    </div>
                  )}
                </div>
                {errors.mb_nick && (
                  <p className="text-red-500 text-xs mt-1">{errors.mb_nick}</p>
                )}
                {nickStatus.message && !errors.mb_nick && (
                  <p className={`text-xs mt-1 ${
                    nickStatus.available ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {nickStatus.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="mb_email" className="text-sm font-medium">
                이메일 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="mb_email"
                  type="email"
                  value={formData.mb_email}
                  onChange={handleEmailChange}
                  className={`${errors.mb_email ? 'border-red-500' : ''} ${
                    emailStatus.available === false ? 'border-red-500' : 
                    emailStatus.available === true ? 'border-green-500' : ''
                  }`}
                  placeholder="이메일을 입력하세요"
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                {emailStatus.checking && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                  </div>
                )}
              </div>
              {errors.mb_email && (
                <p className="text-red-500 text-xs mt-1">{errors.mb_email}</p>
              )}
              {emailStatus.message && !errors.mb_email && (
                <p className={`text-xs mt-1 ${
                  emailStatus.available ? 'text-green-600' : 'text-red-600'
                }`}>
                  {emailStatus.message}
                </p>
              )}
            </div>
          </div>

          {/* 연락처 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">연락처 정보</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mb_hp" className="text-sm font-medium">휴대폰</Label>
                <Input
                  id="mb_hp"
                  value={formData.mb_hp}
                  onChange={(e) => setFormData({ ...formData, mb_hp: e.target.value })}
                  placeholder="휴대폰 번호를 입력하세요"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="mb_tel" className="text-sm font-medium">전화번호</Label>
                <Input
                  id="mb_tel"
                  value={formData.mb_tel}
                  onChange={(e) => setFormData({ ...formData, mb_tel: e.target.value })}
                  placeholder="전화번호를 입력하세요"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* 권한 및 설정 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">권한 및 설정</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mb_level" className="text-sm font-medium">권한 레벨</Label>
                <select
                  id="mb_level"
                  value={formData.mb_level}
                  onChange={(e) => setFormData({ ...formData, mb_level: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  disabled={isSubmitting}
                >
                  <option value={1}>1 - 일반회원</option>
                  <option value={2}>2 - 정회원</option>
                  <option value={3}>3 - 우수회원</option>
                  <option value={5}>5 - 특별회원</option>
                  <option value={10}>10 - 관리자</option>
                </select>
              </div>
              <div>
                <Label htmlFor="mb_point" className="text-sm font-medium">포인트</Label>
                <Input
                  id="mb_point"
                  type="number"
                  value={formData.mb_point}
                  onChange={(e) => setFormData({ ...formData, mb_point: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">추가 설정</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="mb_adult"
                    checked={formData.mb_adult === 1}
                    onChange={(e) => setFormData({ ...formData, mb_adult: e.target.checked ? 1 : 0 })}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="mb_adult" className="text-sm">성인인증</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="mb_mailling"
                    checked={formData.mb_mailling === 1}
                    onChange={(e) => setFormData({ ...formData, mb_mailling: e.target.checked ? 1 : 0 })}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="mb_mailling" className="text-sm">메일수신</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="mb_sms"
                    checked={formData.mb_sms === 1}
                    onChange={(e) => setFormData({ ...formData, mb_sms: e.target.checked ? 1 : 0 })}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="mb_sms" className="text-sm">SMS수신</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="mb_open"
                    checked={formData.mb_open === 1}
                    onChange={(e) => setFormData({ ...formData, mb_open: e.target.checked ? 1 : 0 })}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="mb_open" className="text-sm">정보공개</Label>
                </div>
              </div>
            </div>
          </div>

          {/* 회원 상태 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">회원 상태</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">현재 상태</Label>
                <div className={`inline-block px-2 py-1 rounded text-xs text-white ${getStatusColor()}`}>
                  {getStatusText()}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">본인확인</Label>
                <div className="text-sm text-gray-600">
                  {formData.mb_certify === 'hp' ? '휴대폰' : 
                   formData.mb_certify === 'ipin' ? '아이핀' : 
                   formData.mb_certify === 'simple' ? '간편인증' : '미인증'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}