"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Edit, 
  Trash2, 
  Plus, 
  User,
  Check,
  X,
  ChevronDown,
  Users,
  Shield,
  UserX
} from "lucide-react"

import { MemberAddModal } from "@/components/admin/MemberAddModal"
import { MemberEditModal } from "@/components/admin/MemberEditModal"

interface Member {
  mb_no: number
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
  mb_today_login: string
  mb_datetime: string
  mb_leave_date: string
  mb_intercept_date: string
  mb_email_certify: string
  mb_hp: string
  mb_tel: string
  selected?: boolean
}

interface Stats {
  totalMembers: number
  blockedMembers: number
  withdrawnMembers: number
}

export default function MembersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // URL 파라미터에서 초기값 가져오기
  const [activeMenu, setActiveMenu] = useState("members")
  const [selectedFilter, setSelectedFilter] = useState(searchParams.get("filter") || "전체목록")
  const [searchType, setSearchType] = useState(searchParams.get("searchType") || "회원아이디")
  const [searchValue, setSearchValue] = useState(searchParams.get("searchValue") || "")
  const [members, setMembers] = useState<Member[]>([])
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    blockedMembers: 0,
    withdrawnMembers: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1"))
  const [totalPages, setTotalPages] = useState(1)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  // URL 업데이트 함수
  const updateURL = (params: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "") {
        newSearchParams.set(key, value)
      } else {
        newSearchParams.delete(key)
      }
    })
    
    const newURL = `${window.location.pathname}?${newSearchParams.toString()}`
    router.push(newURL, { scroll: false })
  }

  // 회원 목록 조회
  const fetchMembers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        searchType,
        searchValue,
        filter: selectedFilter
      })

      const response = await fetch(`/api/admin/members?${params}`)
      const data = await response.json()

      if (data.success) {
        setMembers(data.members.map((member: Member) => ({ ...member, selected: false })))
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('회원 목록 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [currentPage, selectedFilter, searchType, searchValue])

  const filters = [
    { id: "전체목록", label: "전체목록", count: `${stats.totalMembers}명` },
    { id: "총회원수", label: `총회원수 ${stats.totalMembers}명`, count: "" },
    { id: "차단", label: `차단 ${stats.blockedMembers}명`, count: "" },
    { id: "탈퇴", label: `탈퇴 ${stats.withdrawnMembers}명`, count: "" }
  ]

  const handleSelectAll = (checked: boolean) => {
    setMembers(members.map(member => ({ ...member, selected: checked })))
  }

  const handleSelectMember = (mb_id: string, checked: boolean) => {
    setMembers(members.map(member => 
      member.mb_id === mb_id ? { ...member, selected: checked } : member
    ))
  }

  const handleBulkEdit = () => {
    const selectedMembers = members.filter(member => member.selected)
    console.log("선택된 회원 수정:", selectedMembers)
  }

  const handleBulkDelete = async () => {
    const selectedMembers = members.filter(member => member.selected)
    if (selectedMembers.length === 0) return

    if (confirm(`선택된 ${selectedMembers.length}명의 회원을 탈퇴 처리하시겠습니까?`)) {
      try {
        for (const member of selectedMembers) {
          await fetch(`/api/admin/members?mb_id=${member.mb_id}`, {
            method: 'DELETE'
          })
        }
        fetchMembers()
      } catch (error) {
        console.error('회원 삭제 실패:', error)
      }
    }
  }

  const handleAddMember = () => {
    setIsAddModalOpen(true)
  }

  const handleSaveMember = async (memberData: any) => {
    try {
      const response = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      })

      const data = await response.json()

      if (data.success) {
        alert('회원이 성공적으로 추가되었습니다.')
        fetchMembers() // 목록 새로고침
      } else {
        alert(data.error || '회원 추가 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 추가 실패:', error)
      alert('네트워크 오류가 발생했습니다.')
    }
  }

  const handleSaveMemberEdit = async (memberData: any) => {
    try {
      const response = await fetch(`/api/admin/members/${memberData.mb_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      })

      const data = await response.json()

      if (data.success) {
        alert('회원 정보가 성공적으로 수정되었습니다.')
        fetchMembers() // 목록 새로고침
        setIsEditModalOpen(false)
        setSelectedMember(null)
      } else {
        alert(data.error || '회원 수정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('회원 수정 실패:', error)
      alert('네트워크 오류가 발생했습니다.')
    }
  }

  const handleEditMember = (mb_id: string) => {
    const member = members.find(m => m.mb_id === mb_id)
    if (member) {
      setSelectedMember(member)
      setIsEditModalOpen(true)
    }
  }

  const handleGroupMember = (mb_id: string) => {
    console.log("회원 그룹 관리:", mb_id)
  }

  // 필터 변경 핸들러
  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter)
    setCurrentPage(1)
    updateURL({ filter, page: "1" })
  }

  // 검색 타입 변경 핸들러
  const handleSearchTypeChange = (type: string) => {
    setSearchType(type)
    updateURL({ searchType: type })
  }

  // 검색 실행 핸들러
  const handleSearch = () => {
    setCurrentPage(1)
    updateURL({ 
      searchValue, 
      searchType, 
      page: "1" 
    })
  }

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    updateURL({ page: page.toString() })
  }

  const getStatusText = (member: Member) => {
    if (member.mb_leave_date) return "탈퇴"
    if (member.mb_intercept_date) return "차단"
    return "정상"
  }

  const getStatusColor = (member: Member) => {
    if (member.mb_leave_date) return "bg-gray-500"
    if (member.mb_intercept_date) return "bg-red-500"
    return "bg-green-500"
  }

  const getCertifyText = (certify: string) => {
    switch (certify) {
      case 'hp': return '휴대폰'
      case 'ipin': return '아이핀'
      case 'simple': return '간편인증'
      default: return '미인증'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '0000-00-00 00:00:00') return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <main className="flex-1 lg:ml-0 p-4">
          <div className="bg-white rounded-lg shadow">
            {/* 헤더 */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">회원관리</h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkEdit}
                  disabled={!members.some(m => m.selected)}
                >
                  선택수정
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={!members.some(m => m.selected)}
                >
                  선택삭제
                </Button>
                <Button size="sm" onClick={handleAddMember} className="bg-pink-500 hover:bg-pink-600">
                  <Plus className="w-3 h-3 mr-1" />
                  회원추가
                </Button>
              </div>
            </div>

            {/* 필터 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex gap-2 mb-3">
                {filters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant={selectedFilter === filter.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange(filter.id)}
                    className={selectedFilter === filter.id ? "bg-blue-600" : ""}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              {/* 검색 */}
              <div className="flex gap-2">
                <select
                  value={searchType}
                  onChange={(e) => handleSearchTypeChange(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="회원아이디">회원아이디</option>
                  <option value="이름">이름</option>
                  <option value="닉네임">닉네임</option>
                  <option value="이메일">이메일</option>
                </select>
                <Input
                  type="text"
                  placeholder="검색어를 입력하세요"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="flex-1 text-xs"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="sm" onClick={handleSearch}>
                  <Search className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="p-3 bg-blue-50 border-b border-blue-200">
              <p className="text-xs text-blue-800">
                회원자료 삭제 시 다른 회원이 기존 회원아이디를 사용하지 못하도록 회원아이디, 이름, 닉네임은 삭제하지 않고 영구 보관합니다.
              </p>
            </div>

            {/* 회원 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={members.length > 0 && members.every(m => m.selected)}
                      />
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>아이디</div>
                      <div className="text-xs text-gray-500">이름 / 닉네임</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">본인확인</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>메일인증</div>
                      <div className="text-xs text-gray-500">SMS수신</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>정보공개</div>
                      <div className="text-xs text-gray-500">성인인증</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>메일수신</div>
                      <div className="text-xs text-gray-500">접근차단</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>상태</div>
                      <div className="text-xs text-gray-500">권한</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>휴대폰</div>
                      <div className="text-xs text-gray-500">전화번호</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>최종접속</div>
                      <div className="text-xs text-gray-500">가입일</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">
                      <div>접근그룹</div>
                      <div className="text-xs text-gray-500">포인트</div>
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-700">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-xs text-gray-500">
                        로딩 중...
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-xs text-gray-500">
                        회원이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr key={member.mb_id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={member.selected || false}
                            onChange={(e) => handleSelectMember(member.mb_id, e.target.checked)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="font-medium text-xs">{member.mb_id}</div>
                          <div className="text-xs text-gray-600">
                            {member.mb_name || '-'} / {member.mb_nick || '-'}
                            {member.mb_nick && <User className="inline w-2 h-2 ml-1" />}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{getCertifyText(member.mb_certify)}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {member.mb_email_certify && member.mb_email_certify !== '0000-00-00 00:00:00' ? (
                              <span className="text-red-500">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_sms ? '수신' : '거부'}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {member.mb_open ? '공개' : '비공개'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_adult ? (
                              <Check className="inline w-2 h-2 text-blue-500" />
                            ) : (
                              <X className="inline w-2 h-2 text-gray-400" />
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {member.mb_mailling ? '수신' : '거부'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_intercept_date ? '차단' : '정상'}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            <Badge className={`${getStatusColor(member)} text-white text-xs`}>
                              {getStatusText(member)}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.mb_level}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{member.mb_hp || '-'}</div>
                          <div className="text-xs text-gray-600">{member.mb_tel || '-'}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">{formatDate(member.mb_today_login)}</div>
                          <div className="text-xs text-gray-600">{formatDate(member.mb_datetime)}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">-</div>
                          <div className="text-xs text-gray-600">{member.mb_point}</div>
                        </td>
                        <td className="p-2">
                          {member.mb_level >= 10 ? (
                            <Button variant="outline" size="sm" onClick={() => handleGroupMember(member.mb_id)}>
                              그룹
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => handleEditMember(member.mb_id)}>
                              수정
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center p-3 border-t border-gray-200">
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    이전
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* 회원 추가 모달 */}
      <MemberAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveMember}
      />

      {/* 회원 수정 모달 */}
      <MemberEditModal
        member={selectedMember}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedMember(null)
        }}
        onSave={handleSaveMemberEdit}
      />
    </div>
  )
}