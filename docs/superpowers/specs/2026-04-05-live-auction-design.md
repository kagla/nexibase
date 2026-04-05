# 실시간 경매 플랫폼 설계 문서

> 넥시베이스에 직접 통합하는 실시간 경매 기능

## 개요

sir.kr 라라벨 경매 레시피를 넥시베이스(Next.js 16 + Prisma + MySQL) 환경에 맞게 포팅.
기존 넥시베이스의 인증, 알림, 이미지 업로드, 관리자 시스템을 그대로 활용한다.

---

## 핵심 결정사항

| 영역 | 결정 |
|------|------|
| 통합 방식 | 넥시베이스에 직접 통합 (`src/app/auction/`, `src/app/api/auction/`) |
| 실시간 | SSE (Server-Sent Events) — 별도 서버 불필요 |
| 알림 | 기존 Notification 모델 + email.ts 재활용 |
| 이미지 | 기존 업로드/리사이징 시스템 재활용 |
| 스케줄러 | 시스템 crontab + API Route |
| DB | Prisma 스키마에 경매 모델 추가 (MySQL) |
| 인증 | 기존 NextAuth + User 모델 활용 |
| API 방식 | API Route (기존 넥시베이스 패턴 일관성 유지) |

---

## 기능 목록

| 기능 | 설명 |
|------|------|
| 실시간 입찰 | SSE로 모든 참가자에게 즉시 업데이트 |
| 경매 상품 관리 | 판매자가 상품 등록, 시작가/즉시구매가 설정 |
| 자동 마감 연장 | 마감 5분 전 입찰 시 자동 5분 연장 |
| 입찰 히스토리 | 상품별 타임라인 조회 |
| 낙찰 알림 | 경매 종료 시 인앱 + 이메일 알림 자동 발송 |
| 입찰 제한 | 최소 입찰 단위 검증, 본인 최고가 재입찰 방지 |
| 실시간 참여자 | SSE 연결 수 기반 참여자 수 표시 |
| 상태 관리 | 예정/진행중/종료 상태별 필터링 및 자동 전환 |
| 자동 입찰 | 최대 금액 설정 시 자동으로 입찰 |
| 즉시구매 | 즉시구매가로 바로 낙찰 |
| Rate Limiting | 사용자당 1분 10회 입찰 제한 |

---

## 데이터베이스 스키마

기존 넥시베이스 패턴(Int ID, `@@map`, `@db` 타입 명시)을 따른다.
금액은 원화 기준 `Int` (기존 Product.price 패턴과 동일).

### Auction (경매 상품)

```prisma
model Auction {
  id            Int       @id @default(autoincrement())
  sellerId      Int
  title         String    @db.VarChar(255)
  description   String    @db.Text
  image         String?   @db.VarChar(500)
  startingPrice Int
  currentPrice  Int
  buyNowPrice   Int?
  bidIncrement  Int       @default(1000)
  bidCount      Int       @default(0)
  startsAt      DateTime
  endsAt        DateTime
  status        String    @default("pending") @db.VarChar(20)
  winnerId      Int?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  seller   User      @relation("AuctionSeller", fields: [sellerId], references: [id])
  winner   User?     @relation("AuctionWinner", fields: [winnerId], references: [id])
  bids     Bid[]
  autoBids AutoBid[]

  @@index([status, endsAt])
  @@index([sellerId])
  @@map("auctions")
}
```

### Bid (입찰 기록)

```prisma
model Bid {
  id        Int      @id @default(autoincrement())
  auctionId Int
  userId    Int
  amount    Int
  isAutoBid Boolean  @default(false)
  createdAt DateTime @default(now())

  auction Auction @relation(fields: [auctionId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@index([auctionId, createdAt])
  @@index([userId])
  @@map("bids")
}
```

### AutoBid (자동 입찰)

```prisma
model AutoBid {
  id        Int      @id @default(autoincrement())
  auctionId Int
  userId    Int
  maxAmount Int
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  auction Auction @relation(fields: [auctionId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@unique([auctionId, userId])
  @@map("auto_bids")
}
```

### User 모델 확장

```prisma
// 기존 User 모델에 추가할 관계
auctionsSelling  Auction[]  @relation("AuctionSeller")
auctionsWon      Auction[]  @relation("AuctionWinner")
bids             Bid[]
autoBids         AutoBid[]
```

참여자 수는 SSE 연결 수로 인메모리 관리 (별도 테이블 불필요).

---

## API 엔드포인트

### 사용자 API (`src/app/api/auction/`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/auction` | 경매 목록 조회 (?status=active) |
| POST | `/api/auction` | 경매 등록 |
| GET | `/api/auction/[id]` | 경매 상세 조회 |
| POST | `/api/auction/[id]/bid` | 입찰 처리 |
| POST | `/api/auction/[id]/auto-bid` | 자동 입찰 설정 |
| POST | `/api/auction/[id]/buy-now` | 즉시구매 |
| GET | `/api/auction/[id]/sse` | SSE 스트림 |

### 관리자 API (`src/app/api/admin/auction/`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/auction` | 관리자 경매 목록 |
| PATCH | `/api/admin/auction/[id]` | 경매 수정/강제종료 |

### 시스템 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auction/cron/close-expired` | 만료 경매 자동 종료 (crontab) |

---

## 페이지 라우트

### 사용자 페이지 (`src/app/auction/`)

| 경로 | 설명 |
|------|------|
| `/auction` | 경매 목록 (상태별 필터: 전체/진행중/예정/종료) |
| `/auction/create` | 경매 등록 폼 |
| `/auction/[id]` | 경매 상세 — 실시간 입찰, 카운트다운 |
| `/auction/my` | 내 입찰/판매 내역 |

### 관리자 페이지 (`src/app/admin/auction/`)

| 경로 | 설명 |
|------|------|
| `/admin/auction` | 경매 관리 목록 |
| `/admin/auction/[id]` | 경매 상세/수정/강제종료 |

---

## 실시간 기능 (SSE)

### 동작 흐름

```
사용자A 입찰 (POST /api/auction/[id]/bid)
    ↓
DB 트랜잭션 처리 (비관적 잠금)
    ↓
인메모리 이벤트 버스에 이벤트 발행
    ↓
SSE 엔드포인트가 이벤트 수신
    ↓
연결된 모든 클라이언트에게 푸시
    ↓
클라이언트 UI 실시간 업데이트
```

### 인메모리 이벤트 버스

```typescript
// src/lib/auction-events.ts
// EventEmitter 기반 경매별 이벤트 관리
// 'bid:{auctionId}' → 새 입찰
// 'end:{auctionId}' → 경매 종료
```

### SSE 이벤트

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `bid` | `{currentPrice, bidCount, bidder, amount, time}` | 새 입찰 |
| `ended` | `{winnerId, winnerNickname, finalPrice}` | 경매 종료 |
| `extended` | `{newEndsAt}` | 마감 시간 연장 |
| `viewers` | `{count}` | 현재 참여자 수 (30초 간격) |

### 참여자 수

SSE 연결/해제 시 인메모리 카운터 관리. 연결 수 = 참여자 수.

### 제한사항

- 서버 재시작 시 SSE 연결 끊김 → 클라이언트 EventSource 자동 재연결
- 단일 서버 전제 (향후 Redis Pub/Sub로 확장 가능)

---

## 핵심 비즈니스 로직

### 입찰 처리 (`POST /api/auction/[id]/bid`)

```
1. 인증 확인 (로그인 필수)
2. 입찰 금액 검증
   - 금액 >= 현재가 + 최소 입찰 단위
   - 금액 <= 999,999,999
   - 본인이 현재 최고가 입찰자면 거부
   - 경매 status === 'active'
3. Prisma 트랜잭션 (동시성 제어)
   - 비관적 잠금 (SELECT ... FOR UPDATE via $queryRaw)
   - Bid 레코드 생성
   - Auction의 currentPrice, bidCount 업데이트
   - 마감 5분 전이면 endsAt + 5분 연장
4. SSE 이벤트 발행 (bid, 필요시 extended)
5. 자동 입찰 트리거
```

### 자동 입찰 로직

```
입찰 발생 후:
1. 해당 경매의 활성 AutoBid 중, 현재가보다 높은 maxAmount 보유자 찾기
2. 방금 입찰한 사람 제외
3. maxAmount가 가장 높은 사람 선택
4. 입찰가 = min(maxAmount, 현재가 + bidIncrement)
5. 자동 입찰 생성 (isAutoBid = true)
6. maxAmount에 도달하면 isActive = false
```

### 즉시구매 (`POST /api/auction/[id]/buy-now`)

```
1. buyNowPrice가 설정된 경매만 가능
2. 트랜잭션:
   - Bid 생성 (amount = buyNowPrice)
   - Auction status → 'ended', winnerId 설정
3. 판매자/낙찰자에게 알림 발송
```

### 경매 자동 종료 (`POST /api/auction/cron/close-expired`)

```
1. status='active' AND endsAt <= now() 인 경매 조회
2. 각 경매:
   - 최고 입찰자 → winnerId
   - status → 'ended'
   - 낙찰자에게 알림 (인앱 + 이메일)
   - 판매자에게 알림 (인앱 + 이메일)
   - 입찰 없으면 유찰 (winnerId = null)
3. SSE 'ended' 이벤트 발행
```

### Rate Limiting

- 입찰: 사용자당 1분 10회 (인메모리 카운터)

---

## 프론트엔드 UI

### 페이지 구성

**경매 목록 (`/auction`)**
- 상태 필터 탭: 전체 / 진행중 / 예정 / 종료
- 카드 그리드: 이미지, 제목, 현재가, 남은시간, 입찰수
- 페이지네이션

**경매 등록 (`/auction/create`)**
- 폼: 제목, 설명, 이미지 업로드, 시작가, 즉시구매가(선택), 최소입찰단위, 시작/종료 시간
- 기존 넥시베이스 폼 스타일

**경매 상세 (`/auction/[id]`)**
- 상품 이미지
- 현재가 (실시간 업데이트)
- 카운트다운 타이머 (1초 갱신)
- 입찰 폼: 금액 입력 + 빠른 입찰 버튼 (+1만, +5만, +10만)
- 즉시구매 버튼 (설정된 경우)
- 자동 입찰 설정 (최대 금액)
- 입찰 히스토리 (최근 입찰 타임라인)
- 현재 참여자 수
- 판매자 정보

**내 경매 (`/auction/my`)**
- 탭: 내 입찰 / 내 판매
- 입찰 현황, 낙찰 여부 표시

**관리자 (`/admin/auction`)**
- 경매 목록 테이블 (기존 관리자 스타일)
- 상태 변경, 강제 종료

### 컴포넌트 (`src/components/auction/`)

| 컴포넌트 | 설명 |
|----------|------|
| `AuctionCard` | 목록용 카드 |
| `AuctionTimer` | 카운트다운 타이머 (클라이언트) |
| `BidForm` | 입찰 폼 + 빠른 입찰 버튼 |
| `BidHistory` | 입찰 내역 타임라인 |
| `AutoBidForm` | 자동 입찰 설정 |
| `AuctionStatusBadge` | 상태 배지 (예정/진행중/종료) |

### 스타일

기존 넥시베이스의 Tailwind CSS + shadcn/ui 패턴을 따른다.

---

## 인프라 & 설정

### MySQL 데이터베이스

```sql
CREATE DATABASE `nexi-live-auction` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nexi-live-auction'@'localhost' IDENTIFIED BY 'nexi-live-auction';
GRANT ALL PRIVILEGES ON `nexi-live-auction`.* TO 'nexi-live-auction'@'localhost';
FLUSH PRIVILEGES;
```

### .env

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=nexi-live-auction
MYSQL_PASS=nexi-live-auction
MYSQL_DB=nexi-live-auction
DATABASE_URL="mysql://nexi-live-auction:nexi-live-auction@localhost:3306/nexi-live-auction"
```

### Crontab

```
* * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/auction/cron/close-expired > /dev/null 2>&1
```

### Cron 보안

환경변수 `CRON_SECRET`으로 인증. API에서 헤더 검증.

### 넥시베이스 설치 순서

```
1. npm install
2. cp .env.example .env → .env 수정
3. MySQL DB/유저 생성
4. npx prisma migrate deploy
5. npx prisma generate
6. npm run dev
```

경매 모델은 Prisma 스키마에 추가 후 새 마이그레이션으로 적용.

---

## 파일 구조

```
src/
├── app/
│   ├── auction/
│   │   ├── page.tsx              ← 경매 목록
│   │   ├── create/page.tsx       ← 경매 등록
│   │   ├── [id]/page.tsx         ← 경매 상세
│   │   └── my/page.tsx           ← 내 경매
│   ├── admin/
│   │   └── auction/
│   │       ├── page.tsx          ← 관리자 목록
│   │       └── [id]/page.tsx     ← 관리자 상세
│   └── api/
│       ├── auction/
│       │   ├── route.ts          ← 목록/등록
│       │   ├── [id]/
│       │   │   ├── route.ts      ← 상세 조회
│       │   │   ├── bid/route.ts  ← 입찰
│       │   │   ├── auto-bid/route.ts ← 자동 입찰
│       │   │   ├── buy-now/route.ts  ← 즉시구매
│       │   │   └── sse/route.ts  ← SSE 스트림
│       │   └── cron/
│       │       └── close-expired/route.ts ← 만료 처리
│       └── admin/
│           └── auction/
│               ├── route.ts      ← 관리자 목록
│               └── [id]/route.ts ← 관리자 수정
├── components/
│   └── auction/
│       ├── AuctionCard.tsx
│       ├── AuctionTimer.tsx
│       ├── BidForm.tsx
│       ├── BidHistory.tsx
│       ├── AutoBidForm.tsx
│       └── AuctionStatusBadge.tsx
└── lib/
    └── auction-events.ts         ← SSE 이벤트 버스
```
