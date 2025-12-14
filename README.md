# NexiBase

> **Next.js-based foundation for intelligent, extensible web applications.**

**NexiBase**는 **Next.js + I + Base**의 합성어로, Next.js를 기반으로 한 차세대 웹 서비스의 기본 구조(Base)를 의미합니다.

여기서 **I**는 *Intelligence, Idea, Interface, Individual, Innovation, Initial*을 포괄하며, AI를 포함한 지능형 기능부터 사용자 중심 설계까지 **확장 가능한 핵심 레이어**를 상징합니다.

## 왜 NexiBase인가?

- **AI 종속 아님** - 트렌드 변화에도 안전한 네이밍
- **I의 확장성** - AI, UX, 개인화 모두 포함 가능
- **Base / Infra 지향** - 프레임워크, 스타터, 플랫폼 어디에도 어울림

---

## 주요 기능

- 회원가입/로그인 (이메일 인증)
- 게시판 CRUD
- 게시글 작성 (Tiptap 에디터)
- 이미지 업로드 (자동 리사이징, WebP 변환)
- 댓글/대댓글
- 리액션 (좋아요, 추천 등)
- 관리자 페이지

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes |
| Database | MySQL + Prisma ORM |
| Editor | Tiptap |
| Image | Sharp |

## 요구사항

- Node.js 18+
- MySQL 8.0+
- npm 또는 yarn

---

## 설치 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd nexibase
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 설정

`.env.example` 파일을 `.env`로 복사 후 수정:

```bash
cp .env.example .env
```

`.env` 파일 편집:

```env
# MySQL 연결 정보
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=your-password
MYSQL_DB=nexibase

# Prisma용 DATABASE_URL (위 값을 조합)
DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}"

# SMTP 설정 (이메일 인증용)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. 데이터베이스 설정

MySQL에서 데이터베이스 생성:

```sql
CREATE DATABASE nexibase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Prisma 스키마 적용:

```bash
npx prisma db push
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

---

## 초기 설정

### 관리자 계정 생성

1. http://localhost:3000/signup 에서 첫 회원가입
2. **첫 번째 가입자는 자동으로 관리자**로 등록됩니다

### 기본 게시판 생성

1. 관리자로 로그인
2. http://localhost:3000/admin/boards 접속
3. "기본 게시판 생성" 버튼 클릭
   - 자유게시판 (free)
   - 공지사항 (notice)
   - 문의게시판 (qa)

---

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 인증 페이지 (로그인, 회원가입)
│   ├── admin/           # 관리자 페이지
│   ├── api/             # API 라우트
│   └── board/           # 게시판 페이지
├── components/          # 공통 컴포넌트
└── lib/                 # 유틸리티
```

---

## 라이선스

MIT
