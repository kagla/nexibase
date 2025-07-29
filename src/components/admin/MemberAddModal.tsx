"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Eye, EyeOff } from "lucide-react"

interface MemberAddForm {
  mb_id: string
  mb_password: string
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
}

interface MemberAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (member: MemberAddForm) => void
}

export function MemberAddModal({ isOpen, onClose, onSave }: MemberAddModalProps) {
  const [formData, setFormData] = useState<MemberAddForm>({
    mb_id: '',
    mb_password: '',
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

  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData({
        mb_id: '',
        mb_password: '',
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
      setErrors({})
      setShowPassword(false)
    }
  }, [isOpen])

  // 유효성 검사
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // 회원 ID 검증
    if (!formData.mb_id.trim()) {
      newErrors.mb_id = '회원 ID를 입력해주세요.'
    } else if (formData.mb_id.length < 3) {
      newErrors.mb_id = '회원 ID는 3자 이상이어야 합니다.'
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.mb_id)) {
      newErrors.mb_id = '회원 ID는 영문, 숫자, 언더바(_)만 사용 가능합니다.'
    }

    // 비밀번호 검증
    if (!formData.mb_password) {
      newErrors.mb_password = '비밀번호를 입력해주세요.'
    } else if (formData.mb_password.length < 6) {
      newErrors.mb_password = '비밀번호는 6자 이상이어야 합니다.'
    }

    // 이름 검증
    if (!formData.mb_name.trim()) {
      newErrors.mb_name = '이름을 입력해주세요.'
    }

    // 닉네임 검증
    if (!formData.mb_nick.trim()) {
      newErrors.mb_nick = '닉네임을 입력해주세요.'
    } else if (formData.mb_nick.length < 2) {
      newErrors.mb_nick = '닉네임은 2자 이상이어야 합니다.'
    }

    // 이메일 검증
    if (!formData.mb_email.trim()) {
      newErrors.mb_email = '이메일을 입력해주세요.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.mb_email)) {
      newErrors.mb_email = '올바른 이메일 형식을 입력해주세요.'
    }

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
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('회원 추가 실패:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">회원 추가</h2>
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
                <Label htmlFor="mb_id" className="text-sm font-medium">
                  회원 ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mb_id"
                  value={formData.mb_id}
                  onChange={(e) => setFormData({ ...formData, mb_id: e.target.value })}
                  className={errors.mb_id ? 'border-red-500' : ''}
                  placeholder="회원 ID를 입력하세요"
                  disabled={isSubmitting}
                />
                {errors.mb_id && (
                  <p className="text-red-500 text-xs mt-1">{errors.mb_id}</p>
                )}
              </div>
              <div>
                <Label htmlFor="mb_password" className="text-sm font-medium">
                  비밀번호 <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="mb_password"
                    type={showPassword ? "text" : "password"}
                    value={formData.mb_password}
                    onChange={(e) => setFormData({ ...formData, mb_password: e.target.value })}
                    className={errors.mb_password ? 'border-red-500 pr-10' : 'pr-10'}
                    placeholder="비밀번호를 입력하세요"
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
                {errors.mb_password && (
                  <p className="text-red-500 text-xs mt-1">{errors.mb_password}</p>
                )}
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
                <Input
                  id="mb_nick"
                  value={formData.mb_nick}
                  onChange={(e) => setFormData({ ...formData, mb_nick: e.target.value })}
                  className={errors.mb_nick ? 'border-red-500' : ''}
                  placeholder="닉네임을 입력하세요"
                  disabled={isSubmitting}
                />
                {errors.mb_nick && (
                  <p className="text-red-500 text-xs mt-1">{errors.mb_nick}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="mb_email" className="text-sm font-medium">
                이메일 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mb_email"
                type="email"
                value={formData.mb_email}
                onChange={(e) => setFormData({ ...formData, mb_email: e.target.value })}
                className={errors.mb_email ? 'border-red-500' : ''}
                placeholder="이메일을 입력하세요"
                disabled={isSubmitting}
              />
              {errors.mb_email && (
                <p className="text-red-500 text-xs mt-1">{errors.mb_email}</p>
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
                <Label htmlFor="mb_point" className="text-sm font-medium">초기 포인트</Label>
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "추가 중..." : "회원 추가"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 