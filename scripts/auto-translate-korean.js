#!/usr/bin/env node
// Conservative Korean→English translator: only replaces phrases that are in an
// exact-match whitelist. No fuzzy pattern generation.
//
// Run after `extract-korean-comments.js` to populate the translation map, then
// run `apply-korean-translations.js` to write the replacements back to source.

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// Exact match: key is the raw extracted Korean phrase, value is the English
// replacement. The extracted phrases include the comment markers (// or {/* */})
// when they were captured from comment lines, or the quoted form for console
// strings.
const EXACT = {
  // ---- Line comments (//) ----
  '// 헤더': '// Header',
  '// 푸터': '// Footer',
  '// 사이드바': '// Sidebar',
  '// 페이지네이션': '// Pagination',
  '// 검색': '// Search',
  '// 모달': '// Modal',
  '// 필터': '// Filters',
  '// 정렬': '// Sort',
  '// 로그인 확인': '// Login check',
  '// 인증 확인': '// Auth check',
  '// 권한 확인': '// Authorization check',
  '// 관리자 권한 확인': '// Admin privilege check',
  '// 날짜 포맷': '// Date format',
  '// 시간 포맷': '// Time format',
  '// 디렉토리 생성': '// Create directory',
  '// 파일 크기 검증': '// Validate file size',
  '// 파일 타입 검증': '// Validate file type',
  '// 파일 크기 포맷': '// Format file size',
  '// 파일 아이콘 선택': '// Pick file icon',
  '// 파일이 없어도 무시': '// Ignore when the file does not exist',
  '// 재고 복구': '// Restore stock',
  '// PendingOrder 삭제': '// Delete PendingOrder',
  '// 개별 선택': '// Select one',
  '// 전체 선택': '// Select all',
  '// 선택 삭제': '// Delete selected',
  '// 일괄 삭제': '// Bulk delete',
  '// 사용자 생성': '// Create user',
  '// 세션 확인': '// Session check',
  '// 세션 생성': '// Create session',
  '// 세션 삭제': '// Delete session',
  '// 페이지네이션 처리': '// Pagination',
  '// 페이지네이션 계산': '// Pagination calculation',
  '// 페이지네이션 정보': '// Pagination info',
  '// 필수 필드 검증': '// Validate required fields',
  '// 필수 필드 확인': '// Check required fields',
  '// 기본 설정': '// Default settings',
  '// 기본 정보': '// Basic info',
  '// 응답 반환': '// Return response',
  '// 에러 처리': '// Error handling',
  '// 에러 응답': '// Error response',
  '// 성공 응답': '// Success response',
  '// 실패 응답': '// Failure response',
  '// 검색 조건': '// Search conditions',
  '// 검색 결과': '// Search results',
  '// 검색 실행': '// Run search',
  '// 트랜잭션 시작': '// Begin transaction',
  '// 트랜잭션 종료': '// End transaction',
  '// 트랜잭션 롤백': '// Transaction rollback',
  '// 비밀번호 해시': '// Hash password',
  '// 비밀번호 검증': '// Verify password',
  '// 비밀번호 변경': '// Change password',
  '// 소프트 삭제': '// Soft delete',
  '// 소프트 삭제: deletedAt에 현재 시간 설정': '// Soft delete: set deletedAt to now',
  '// 관리자 최소 1명 유지 체크': '// Guard: keep at least one admin',
  '// 중복 체크': '// Duplicate check',
  '// 슬러그 중복 확인': '// Check slug uniqueness',
  '// 기본 게시판 생성': '// Create default boards',
  '// 게시판 조회': '// Fetch board',
  '// 게시판 생성': '// Create board',
  '// 게시판 삭제': '// Delete board',
  '// 게시판 수정': '// Edit board',
  '// 게시판 업데이트': '// Update board',
  '// 게시판 정보 조회': '// Fetch board info',
  '// 게시판 목록 조회': '// Fetch board list',
  '// 게시글 조회': '// Fetch post',
  '// 게시글 생성': '// Create post',
  '// 게시글 삭제': '// Delete post',
  '// 게시글 수정': '// Edit post',
  '// 게시글 업데이트': '// Update post',
  '// 게시글 목록 조회': '// Fetch post list',
  '// 상품 찾기': '// Find product',
  '// 상품 조회': '// Fetch product',
  '// 상품 생성': '// Create product',
  '// 상품 삭제': '// Delete product',
  '// 상품 수정': '// Edit product',
  '// 상품 업데이트': '// Update product',
  '// 상품 목록 조회': '// Fetch product list',
  '// 주문 조회': '// Fetch order',
  '// 주문 생성': '// Create order',
  '// 주문 삭제': '// Delete order',
  '// 주문 수정': '// Edit order',
  '// 주문 업데이트': '// Update order',
  '// 주문 목록 조회': '// Fetch order list',
  '// 댓글 조회': '// Fetch comment',
  '// 댓글 생성': '// Create comment',
  '// 댓글 삭제': '// Delete comment',
  '// 댓글 작성': '// Write comment',
  '// 댓글 목록 조회': '// Fetch comment list',
  '// 사용자 조회': '// Fetch user',
  '// 사용자 목록 조회': '// Fetch user list',
  '// 회원 조회': '// Fetch member',
  '// 회원 목록 조회': '// Fetch member list',
  '// 메뉴 조회': '// Fetch menu',
  '// 메뉴 목록 조회': '// Fetch menu list',
  '// 설정 조회': '// Fetch settings',
  '// 설정 저장': '// Save settings',
  '// 설정 업데이트': '// Update settings',
  '// 카테고리 조회': '// Fetch category',
  '// 카테고리 목록 조회': '// Fetch category list',
  '// 리뷰 조회': '// Fetch review',
  '// 리뷰 목록 조회': '// Fetch review list',
  '// 리뷰 작성': '// Write review',
  '// 쇼핑몰 설정 가져오기': '// Load shop settings',
  '// 쇼핑몰 설정 조회': '// Fetch shop settings',
  '// 날짜 계산': '// Date math',
  '// 기본값': '// Default value',
  '// 필수 필드': '// Required fields',
  '// URL 반환': '// Return URL',
  '// 허용 이미지 타입': '// Allowed image types',
  '// 허용된 리액션 타입 (긍정적인 것만)': '// Allowed reaction types (positive only)',
  '// 리액션 집계': '// Aggregate reactions',
  "// 사용자의 리액션 조회": "// Fetch the user's reaction",
  '// 결과 포맷팅': '// Format the result',
  '// 유효한 리액션 타입인지 확인': '// Ensure the reaction type is valid',
  '// 반응 기능 확인': '// Check whether reactions are enabled',
  '// 기존 반응 확인 (같은 타입)': '// Check for an existing reaction of the same type',
  '// 이미 반응이 있으면 취소': '// If the reaction already exists, remove it',
  '// likeCount 업데이트 (like 타입만)': '// Update likeCount (only for the "like" type)',
  '// 반응 추가': '// Add reaction',
  '// 업데이트된 리액션 정보 조회': '// Fetch the updated reaction info',
  '// likeCount 업데이트 (모든 리액션 타입)': '// Update likeCount (all reaction types)',
  '// 이미지 리사이징 및 WebP 변환': '// Resize and convert to WebP',
  '// 기존 프로필 이미지 삭제 (로컬 파일인 경우)': '// Delete the existing profile image (only when it is a local file)',
  '// 썸네일 경로: xxx.webp -> xxx-thumb.webp': '// Thumbnail path: xxx.webp -> xxx-thumb.webp',
  '// 원본 이미지 삭제': '// Delete the original image',
  '// 썸네일 이미지 삭제': '// Delete the thumbnail image',
  '// request에서 호스트 정보를 가져와 baseUrl 생성': '// Build baseUrl from the request host',
  '// 글쓰기/댓글쓰기는 항상 회원만 가능 (비회원 글쓰기는 이름/비번 필드가 필요하므로 지원하지 않음)':
    '// Posting and commenting are member-only (guest posting requires name/password fields and is not supported)',
  '// 게시판 삭제 (연관된 posts, comments, reactions는 CASCADE로 자동 삭제)':
    '// Delete the board (related posts, comments, and reactions cascade automatically)',
  '// PG 취소 결과': '// PG cancellation result',
  '// 카드 결제인 경우 PG 승인 취소': '// For card payments, cancel the PG approval',
  '// paymentInfo에 취소 정보 추가': '// Append cancellation info to paymentInfo',
  '// paymentInfo에서 tid 추출': '// Extract tid from paymentInfo',
  '// 재고 복구 + 주문 취소': '// Restore stock and cancel the order',
  '// 판매 수량 감소': '// Decrement sold quantity',
  '// 주문 상태 변경 (전액 환불)': '// Update order status (full refund)',
  '// 실제 운영 모드에서 PG 취소 실패 시 에러 반환': '// In production, return an error when PG cancellation fails',
  '// 타임스탬프 생성 (YYYYMMDDhhmmss 형식)': '// Build a timestamp (YYYYMMDDhhmmss)',
  '// AbortController로 타임아웃 설정 (10초)': '// 10-second timeout via AbortController',
  '// data 객체 생성': '// Build the data object',
  '// 해시 데이터 생성 (공식 샘플: key + mid + type + timestamp + JSON.stringify(data))':
    '// Build the hash data (official sample: key + mid + type + timestamp + JSON.stringify(data))',
  '// 요청 파라미터': '// Request parameters',
  '// 검색 및 액션': '// Search and actions',

  // ---- JSX comments ----
  '{/* 헤더 */}': '{/* Header */}',
  '{/* 푸터 */}': '{/* Footer */}',
  '{/* 사이드바 */}': '{/* Sidebar */}',
  '{/* 페이지네이션 */}': '{/* Pagination */}',
  '{/* 검색 */}': '{/* Search */}',
  '{/* 검색 및 액션 */}': '{/* Search and actions */}',
  '{/* 모달 */}': '{/* Modal */}',
  '{/* 필터 */}': '{/* Filters */}',
  '{/* 이미지 */}': '{/* Image */}',
  '{/* 정보 */}': '{/* Info */}',
  '{/* 안내 */}': '{/* Help message */}',
  '{/* 배송지 정보 */}': '{/* Shipping address */}',
  '{/* 결제 정보 */}': '{/* Payment info */}',
  '{/* 답변 */}': '{/* Reply */}',
  '{/* 이전 버튼 */}': '{/* Previous button */}',
  '{/* 다음 버튼 */}': '{/* Next button */}',
  '{/* 작성자 정보 */}': '{/* Author info */}',
  '{/* 기본 정보 */}': '{/* Basic info */}',
  '{/* 통계 카드 */}': '{/* Stats cards */}',
  '{/* 주문 상품 */}': '{/* Order items */}',
  '{/* 상품 정보 */}': '{/* Product info */}',
  '{/* 상품 이미지 */}': '{/* Product images */}',
  '{/* 상품 설명 */}': '{/* Product description */}',
  '{/* 가격 */}': '{/* Price */}',
  '{/* 수량 */}': '{/* Quantity */}',
  '{/* 액션 */}': '{/* Actions */}',
  '{/* 액션 버튼 */}': '{/* Action buttons */}',
  '{/* 탭 */}': '{/* Tabs */}',
  '{/* 목록 */}': '{/* List */}',
  '{/* 테이블 */}': '{/* Table */}',
  '{/* 폼 */}': '{/* Form */}',
  '{/* 로딩 */}': '{/* Loading */}',
  '{/* 에러 */}': '{/* Error */}',
  '{/* 성공 */}': '{/* Success */}',
  '{/* 권한 설정 */}': '{/* Permission settings */}',
  '{/* 기능 설정 */}': '{/* Feature settings */}',
  '{/* 표시 설정 */}': '{/* Display settings */}',

  // ---- console.* string literals ----
  "'카테고리 조회 에러:'": "'failed to fetch categories:'",
  "'게시판 목록 조회 에러:'": "'failed to fetch boards:'",
  "'게시판 조회 에러:'": "'failed to fetch board:'",
  "'게시판 삭제 에러:'": "'failed to delete board:'",
  "'게시글 조회 에러:'": "'failed to fetch post:'",
  "'삭제 에러:'": "'delete error:'",
  "'저장 에러:'": "'save error:'",
  "'주문 목록 조회 에러:'": "'failed to fetch orders:'",
  "'상품 조회 에러:'": "'failed to fetch product:'",
  "'파일 업로드 에러:'": "'file upload error:'",
  "'프로필 이미지 삭제 에러:'": "'failed to delete profile image:'",
  "'사용자 정보 조회 에러:'": "'failed to fetch user:'",
  "'일괄 삭제 에러:'": "'bulk delete error:'",
  "'콘텐츠 조회 에러:'": "'failed to fetch content:'",
  "'기본 게시판 생성 에러:'": "'failed to create default boards:'",
  "'리액션 조회 에러:'": "'failed to fetch reactions:'",
  "'이니시스 취소 응답:'": "'inicis cancellation response:'",
  "'이니시스 취소 API 타임아웃'": "'inicis cancellation API timeout'",
  "'이니시스 취소 API 호출 에러:'": "'inicis cancellation API call failed:'",
  "'PG 취소 결과:'": "'PG cancellation result:'",
}

function main() {
  const mapPath = path.join(ROOT, 'scripts', 'korean-translations.json')
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

  let auto = 0
  let unresolved = 0
  const unresolvedList = []

  for (const key of Object.keys(map)) {
    if (map[key] != null) continue
    if (key in EXACT) {
      map[key] = EXACT[key]
      auto++
    } else {
      unresolved++
      unresolvedList.push(key)
    }
  }

  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2))
  console.log(`Filled ${auto} entries, ${unresolved} unresolved.`)
  if (unresolvedList.length > 0) {
    const unresolvedPath = path.join(ROOT, 'scripts', 'korean-unresolved.txt')
    fs.writeFileSync(unresolvedPath, unresolvedList.join('\n'))
    console.log(`Unresolved entries written to ${unresolvedPath}`)
  }
}

main()
