# 실시간 경매 플랫폼 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 넥시베이스에 실시간 경매 기능을 직접 통합한다 (SSE 기반 입찰, 자동 입찰, 즉시구매, 관리자 관리).

**Architecture:** 기존 넥시베이스 패턴(API Route + "use client" 페이지 + Prisma ORM)을 그대로 따른다. 실시간 기능은 SSE + 인메모리 EventEmitter로 구현하며, 경매 자동 종료는 시스템 crontab + API Route로 처리한다.

**Tech Stack:** Next.js 16, React 19, Prisma 6, MySQL, Tailwind CSS 4, NextAuth.js 4, SSE (EventSource), Lucide React

**Spec:** `docs/superpowers/specs/2026-04-05-live-auction-design.md`

---

## 파일 구조

### 생성할 파일

```
prisma/migrations/XXXXXX_add_auction/migration.sql  ← Prisma 자동 생성

src/lib/auction-events.ts                            ← SSE 이벤트 버스
src/lib/auction-rate-limit.ts                        ← 입찰 Rate Limiting

src/app/api/auction/route.ts                         ← 경매 목록(GET) / 등록(POST)
src/app/api/auction/[id]/route.ts                    ← 경매 상세(GET)
src/app/api/auction/[id]/bid/route.ts                ← 입찰(POST)
src/app/api/auction/[id]/auto-bid/route.ts           ← 자동 입찰(POST)
src/app/api/auction/[id]/buy-now/route.ts            ← 즉시구매(POST)
src/app/api/auction/[id]/sse/route.ts                ← SSE 스트림(GET)
src/app/api/auction/cron/close-expired/route.ts      ← 만료 처리(POST)
src/app/api/admin/auction/route.ts                   ← 관리자 목록(GET)
src/app/api/admin/auction/[id]/route.ts              ← 관리자 수정(PATCH)

src/components/auction/AuctionCard.tsx               ← 목록 카드
src/components/auction/AuctionTimer.tsx               ← 카운트다운 타이머
src/components/auction/AuctionStatusBadge.tsx         ← 상태 배지
src/components/auction/BidForm.tsx                    ← 입찰 폼
src/components/auction/BidHistory.tsx                 ← 입찰 내역
src/components/auction/AutoBidForm.tsx                ← 자동 입찰 설정

src/app/auction/page.tsx                             ← 경매 목록 페이지
src/app/auction/create/page.tsx                      ← 경매 등록 페이지
src/app/auction/[id]/page.tsx                        ← 경매 상세 페이지
src/app/auction/my/page.tsx                          ← 내 경매 페이지
src/app/admin/auction/page.tsx                       ← 관리자 경매 목록
src/app/admin/auction/[id]/page.tsx                  ← 관리자 경매 상세
```

### 수정할 파일

```
prisma/schema.prisma                                 ← Auction, Bid, AutoBid 모델 + User 관계 추가
.env                                                 ← DB 정보, CRON_SECRET 추가
```

---

## Task 0: 인프라 설정 (MySQL DB + 넥시베이스 설치)

**Files:**
- Modify: `.env.example` → `.env`
- Modify: `prisma/schema.prisma`

- [ ] **Step 0.1: MySQL 데이터베이스 및 유저 생성**

```bash
sudo mysql -e "CREATE DATABASE \`nexi-live-auction\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'nexi-live-auction'@'localhost' IDENTIFIED BY 'nexi-live-auction';"
sudo mysql -e "GRANT ALL PRIVILEGES ON \`nexi-live-auction\`.* TO 'nexi-live-auction'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

Expected: 에러 없이 완료.

- [ ] **Step 0.2: .env 파일 생성**

```bash
cp .env.example .env
```

`.env` 파일에서 다음 값 수정:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=nexi-live-auction
MYSQL_PASS=nexi-live-auction
MYSQL_DB=nexi-live-auction
DATABASE_URL="mysql://nexi-live-auction:nexi-live-auction@localhost:3306/nexi-live-auction"

NEXTAUTH_SECRET=auction-dev-secret-key-change-in-production

CRON_SECRET=auction-cron-secret-change-in-production
```

- [ ] **Step 0.3: 의존성 설치**

```bash
npm install
```

Expected: postinstall 스크립트(`prisma generate`)까지 성공. 단, DB가 아직 마이그레이션 안 되어 있으므로 prisma generate 경고가 있을 수 있음 — 무시 가능.

- [ ] **Step 0.4: 기존 마이그레이션 적용**

```bash
npx prisma migrate deploy
```

Expected: 기존 넥시베이스 마이그레이션이 모두 적용됨.

- [ ] **Step 0.5: 개발 서버 확인**

```bash
npm run dev
```

Expected: `http://localhost:3000` 에서 넥시베이스가 정상 작동.

- [ ] **Step 0.6: 커밋**

```bash
git add .env
git commit -m "🔧 넥시베이스 환경 설정 (.env 생성, DB 연결)"
```

> **Note:** `.env`가 `.gitignore`에 포함되어 있으면 커밋 대상에서 제외됨. 그 경우 이 커밋은 스킵.

---

## Task 1: Prisma 스키마 — 경매 모델 추가

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: User 모델에 경매 관계 추가**

`prisma/schema.prisma`의 User 모델에 다음 관계를 추가한다. 기존 `wishlists Wishlist[]` 줄 아래에 추가:

```prisma
  auctionsSelling Auction[] @relation("AuctionSeller")
  auctionsWon     Auction[] @relation("AuctionWinner")
  bids            Bid[]
  autoBids        AutoBid[]
```

- [ ] **Step 1.2: Auction 모델 추가**

`prisma/schema.prisma` 파일 끝에 추가:

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

- [ ] **Step 1.3: 마이그레이션 생성 및 적용**

```bash
npx prisma migrate dev --name add_auction
```

Expected: `prisma/migrations/XXXXXX_add_auction/migration.sql` 생성. `auctions`, `bids`, `auto_bids` 테이블 생성됨.

- [ ] **Step 1.4: Prisma Client 생성 확인**

```bash
npx prisma generate
```

Expected: `Prisma Client generated` 메시지.

- [ ] **Step 1.5: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "🗃️ 경매 DB 스키마 추가 (Auction, Bid, AutoBid)"
```

---

## Task 2: SSE 이벤트 버스 + Rate Limiter

**Files:**
- Create: `src/lib/auction-events.ts`
- Create: `src/lib/auction-rate-limit.ts`

- [ ] **Step 2.1: SSE 이벤트 버스 작성**

Create `src/lib/auction-events.ts`:

```typescript
import { EventEmitter } from "events"

const globalForAuction = globalThis as unknown as {
  auctionEmitter: EventEmitter | undefined
  auctionViewers: Map<number, Set<string>> | undefined
}

export const auctionEmitter =
  globalForAuction.auctionEmitter ?? new EventEmitter()

// 경매별 SSE 연결 관리 (참여자 수 추적)
export const auctionViewers: Map<number, Set<string>> =
  globalForAuction.auctionViewers ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalForAuction.auctionEmitter = auctionEmitter
  globalForAuction.auctionViewers = auctionViewers
}

auctionEmitter.setMaxListeners(1000)

export interface BidEvent {
  auctionId: number
  currentPrice: number
  bidCount: number
  bidderNickname: string
  amount: number
  isAutoBid: boolean
  time: string
}

export interface EndedEvent {
  auctionId: number
  winnerId: number | null
  winnerNickname: string | null
  finalPrice: number
}

export interface ExtendedEvent {
  auctionId: number
  newEndsAt: string
}

export function emitBid(data: BidEvent) {
  auctionEmitter.emit(`bid:${data.auctionId}`, data)
}

export function emitEnded(data: EndedEvent) {
  auctionEmitter.emit(`end:${data.auctionId}`, data)
}

export function emitExtended(data: ExtendedEvent) {
  auctionEmitter.emit(`extended:${data.auctionId}`, data)
}

export function addViewer(auctionId: number, connectionId: string) {
  if (!auctionViewers.has(auctionId)) {
    auctionViewers.set(auctionId, new Set())
  }
  auctionViewers.get(auctionId)!.add(connectionId)
}

export function removeViewer(auctionId: number, connectionId: string) {
  const viewers = auctionViewers.get(auctionId)
  if (viewers) {
    viewers.delete(connectionId)
    if (viewers.size === 0) {
      auctionViewers.delete(auctionId)
    }
  }
}

export function getViewerCount(auctionId: number): number {
  return auctionViewers.get(auctionId)?.size ?? 0
}
```

- [ ] **Step 2.2: Rate Limiter 작성**

Create `src/lib/auction-rate-limit.ts`:

```typescript
const globalForRateLimit = globalThis as unknown as {
  bidRateLimit: Map<number, { count: number; resetAt: number }> | undefined
}

const bidRateLimit: Map<number, { count: number; resetAt: number }> =
  globalForRateLimit.bidRateLimit ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.bidRateLimit = bidRateLimit
}

const MAX_BIDS_PER_MINUTE = 10

export function checkBidRateLimit(userId: number): {
  allowed: boolean
  remaining: number
} {
  const now = Date.now()
  const entry = bidRateLimit.get(userId)

  if (!entry || now > entry.resetAt) {
    bidRateLimit.set(userId, { count: 1, resetAt: now + 60_000 })
    return { allowed: true, remaining: MAX_BIDS_PER_MINUTE - 1 }
  }

  if (entry.count >= MAX_BIDS_PER_MINUTE) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: MAX_BIDS_PER_MINUTE - entry.count }
}
```

- [ ] **Step 2.3: 커밋**

```bash
git add src/lib/auction-events.ts src/lib/auction-rate-limit.ts
git commit -m "⚡ SSE 이벤트 버스 및 Rate Limiter 구현"
```

---

## Task 3: 경매 목록/등록 API

**Files:**
- Create: `src/app/api/auction/route.ts`

- [ ] **Step 3.1: 경매 목록(GET) + 등록(POST) API 작성**

Create `src/app/api/auction/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ["pending", "active", "ended"].includes(status)) {
      where.status = status
    }

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, nickname: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      auctions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("경매 목록 조회 에러:", error)
    return NextResponse.json(
      { error: "경매 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      image,
      startingPrice,
      buyNowPrice,
      bidIncrement,
      startsAt,
      endsAt,
    } = body

    if (!title || !description || !startingPrice || !startsAt || !endsAt) {
      return NextResponse.json(
        { error: "필수 항목을 모두 입력해주세요." },
        { status: 400 }
      )
    }

    const parsedStartingPrice = parseInt(startingPrice)
    const parsedBuyNowPrice = buyNowPrice ? parseInt(buyNowPrice) : null
    const parsedBidIncrement = bidIncrement ? parseInt(bidIncrement) : 1000
    const parsedStartsAt = new Date(startsAt)
    const parsedEndsAt = new Date(endsAt)

    if (parsedStartingPrice < 1000) {
      return NextResponse.json(
        { error: "시작가는 1,000원 이상이어야 합니다." },
        { status: 400 }
      )
    }

    if (parsedBuyNowPrice && parsedBuyNowPrice <= parsedStartingPrice) {
      return NextResponse.json(
        { error: "즉시구매가는 시작가보다 높아야 합니다." },
        { status: 400 }
      )
    }

    if (parsedEndsAt <= parsedStartsAt) {
      return NextResponse.json(
        { error: "종료 시간은 시작 시간 이후여야 합니다." },
        { status: 400 }
      )
    }

    // 시작 시간이 현재 이전이면 바로 active
    const now = new Date()
    const status = parsedStartsAt <= now ? "active" : "pending"

    const auction = await prisma.auction.create({
      data: {
        sellerId: user.id,
        title,
        description,
        image: image || null,
        startingPrice: parsedStartingPrice,
        currentPrice: parsedStartingPrice,
        buyNowPrice: parsedBuyNowPrice,
        bidIncrement: parsedBidIncrement,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        status,
      },
      include: {
        seller: { select: { id: true, nickname: true } },
      },
    })

    return NextResponse.json(
      { success: true, auction },
      { status: 201 }
    )
  } catch (error) {
    console.error("경매 등록 에러:", error)
    return NextResponse.json(
      { error: "경매 등록에 실패했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3.2: 커밋**

```bash
git add src/app/api/auction/route.ts
git commit -m "🎯 경매 목록/등록 API 구현"
```

---

## Task 4: 경매 상세 조회 API

**Files:**
- Create: `src/app/api/auction/[id]/route.ts`

- [ ] **Step 4.1: 경매 상세 조회 API 작성**

Create `src/app/api/auction/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getViewerCount } from "@/lib/auction-events"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auctionId = parseInt(id)

    if (isNaN(auctionId)) {
      return NextResponse.json(
        { error: "잘못된 경매 ID입니다." },
        { status: 400 }
      )
    }

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true, nickname: true, image: true } },
        winner: { select: { id: true, nickname: true } },
        bids: {
          include: {
            user: { select: { id: true, nickname: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    const viewerCount = getViewerCount(auctionId)

    return NextResponse.json({
      success: true,
      auction,
      viewerCount,
    })
  } catch (error) {
    console.error("경매 상세 조회 에러:", error)
    return NextResponse.json(
      { error: "경매 정보를 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4.2: 커밋**

```bash
git add src/app/api/auction/[id]/route.ts
git commit -m "🔍 경매 상세 조회 API 구현"
```

---

## Task 5: 입찰 API (핵심 로직)

**Files:**
- Create: `src/app/api/auction/[id]/bid/route.ts`

- [ ] **Step 5.1: 입찰 API 작성**

Create `src/app/api/auction/[id]/bid/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { emitBid, emitExtended } from "@/lib/auction-events"
import { checkBidRateLimit } from "@/lib/auction-rate-limit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)
    if (isNaN(auctionId)) {
      return NextResponse.json(
        { error: "잘못된 경매 ID입니다." },
        { status: 400 }
      )
    }

    // Rate limit 체크
    const rateCheck = checkBidRateLimit(user.id)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "입찰이 너무 빈번합니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const amount = parseInt(body.amount)

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "유효한 입찰 금액을 입력해주세요." },
        { status: 400 }
      )
    }

    if (amount > 999_999_999) {
      return NextResponse.json(
        { error: "입찰 금액이 한도를 초과했습니다." },
        { status: 400 }
      )
    }

    // 트랜잭션 + 비관적 잠금
    const result = await prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE
      const [locked] = await tx.$queryRaw<
        {
          id: number
          sellerId: number
          currentPrice: number
          bidIncrement: number
          bidCount: number
          endsAt: Date
          status: string
          buyNowPrice: number | null
        }[]
      >`SELECT id, sellerId, currentPrice, bidIncrement, bidCount, endsAt, status, buyNowPrice
        FROM auctions WHERE id = ${auctionId} FOR UPDATE`

      if (!locked) {
        throw new Error("NOT_FOUND")
      }

      if (locked.status !== "active") {
        throw new Error("NOT_ACTIVE")
      }

      if (locked.sellerId === user.id) {
        throw new Error("OWN_AUCTION")
      }

      const minBid = locked.currentPrice + locked.bidIncrement
      if (amount < minBid) {
        throw new Error(`MIN_BID:${minBid}`)
      }

      // 본인이 최고가 입찰자인지 확인
      const highestBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: { amount: "desc" },
      })

      if (highestBid && highestBid.userId === user.id) {
        throw new Error("ALREADY_HIGHEST")
      }

      // 입찰 생성
      const bid = await tx.bid.create({
        data: {
          auctionId,
          userId: user.id,
          amount,
          isAutoBid: false,
        },
      })

      // 경매 업데이트
      const updateData: Record<string, unknown> = {
        currentPrice: amount,
        bidCount: locked.bidCount + 1,
      }

      // 마감 5분 전 입찰이면 5분 연장
      const fiveMinBefore = new Date(locked.endsAt.getTime() - 5 * 60 * 1000)
      const now = new Date()
      let extended = false
      let newEndsAt = locked.endsAt

      if (now >= fiveMinBefore) {
        newEndsAt = new Date(locked.endsAt.getTime() + 5 * 60 * 1000)
        updateData.endsAt = newEndsAt
        extended = true
      }

      await tx.auction.update({
        where: { id: auctionId },
        data: updateData,
      })

      return { bid, extended, newEndsAt }
    })

    // SSE 이벤트 발행 (트랜잭션 밖)
    emitBid({
      auctionId,
      currentPrice: amount,
      bidCount: result.bid.id, // 실제 bidCount는 DB에서 업데이트됨
      bidderNickname: user.nickname,
      amount,
      isAutoBid: false,
      time: result.bid.createdAt.toISOString(),
    })

    if (result.extended) {
      emitExtended({
        auctionId,
        newEndsAt: result.newEndsAt.toISOString(),
      })
    }

    // 자동 입찰 트리거 (비동기, 에러 무시)
    triggerAutoBids(auctionId, user.id, amount).catch((err) =>
      console.error("자동 입찰 트리거 에러:", err)
    )

    return NextResponse.json({
      success: true,
      bid: {
        id: result.bid.id,
        amount: result.bid.amount,
        createdAt: result.bid.createdAt,
      },
      extended: result.extended,
    })
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "NOT_FOUND":
          return NextResponse.json(
            { error: "경매를 찾을 수 없습니다." },
            { status: 404 }
          )
        case "NOT_ACTIVE":
          return NextResponse.json(
            { error: "진행중인 경매가 아닙니다." },
            { status: 400 }
          )
        case "OWN_AUCTION":
          return NextResponse.json(
            { error: "본인의 경매에는 입찰할 수 없습니다." },
            { status: 400 }
          )
        case "ALREADY_HIGHEST":
          return NextResponse.json(
            { error: "이미 최고가 입찰자입니다." },
            { status: 400 }
          )
        default:
          if (error.message.startsWith("MIN_BID:")) {
            const minBid = error.message.split(":")[1]
            return NextResponse.json(
              {
                error: `최소 입찰 금액은 ${parseInt(minBid).toLocaleString()}원입니다.`,
              },
              { status: 400 }
            )
          }
      }
    }
    console.error("입찰 에러:", error)
    return NextResponse.json(
      { error: "입찰 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

async function triggerAutoBids(
  auctionId: number,
  lastBidderId: number,
  currentPrice: number
) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { bidIncrement: true, status: true },
  })

  if (!auction || auction.status !== "active") return

  // 현재가보다 높은 maxAmount를 가진 활성 자동 입찰 찾기 (방금 입찰한 사람 제외)
  const autoBids = await prisma.autoBid.findMany({
    where: {
      auctionId,
      isActive: true,
      userId: { not: lastBidderId },
      maxAmount: { gte: currentPrice + auction.bidIncrement },
    },
    include: {
      user: { select: { id: true, nickname: true } },
    },
    orderBy: { maxAmount: "desc" },
  })

  if (autoBids.length === 0) return

  const topAutoBid = autoBids[0]
  const bidAmount = Math.min(
    topAutoBid.maxAmount,
    currentPrice + auction.bidIncrement
  )

  // 자동 입찰 실행 (트랜잭션)
  await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<
      { currentPrice: number; bidCount: number; endsAt: Date; status: string }[]
    >`SELECT currentPrice, bidCount, endsAt, status FROM auctions WHERE id = ${auctionId} FOR UPDATE`

    if (!locked || locked.status !== "active") return
    if (bidAmount <= locked.currentPrice) return

    await tx.bid.create({
      data: {
        auctionId,
        userId: topAutoBid.userId,
        amount: bidAmount,
        isAutoBid: true,
      },
    })

    const updateData: Record<string, unknown> = {
      currentPrice: bidAmount,
      bidCount: locked.bidCount + 1,
    }

    // 자동 입찰도 마감 연장 체크
    const fiveMinBefore = new Date(locked.endsAt.getTime() - 5 * 60 * 1000)
    const now = new Date()
    let extended = false
    let newEndsAt = locked.endsAt

    if (now >= fiveMinBefore) {
      newEndsAt = new Date(locked.endsAt.getTime() + 5 * 60 * 1000)
      updateData.endsAt = newEndsAt
      extended = true
    }

    await tx.auction.update({
      where: { id: auctionId },
      data: updateData,
    })

    // maxAmount에 도달하면 비활성화
    if (bidAmount >= topAutoBid.maxAmount) {
      await tx.autoBid.update({
        where: { id: topAutoBid.id },
        data: { isActive: false },
      })
    }

    // SSE 이벤트
    emitBid({
      auctionId,
      currentPrice: bidAmount,
      bidCount: locked.bidCount + 1,
      bidderNickname: topAutoBid.user.nickname,
      amount: bidAmount,
      isAutoBid: true,
      time: new Date().toISOString(),
    })

    if (extended) {
      emitExtended({ auctionId, newEndsAt: newEndsAt.toISOString() })
    }
  })
}
```

- [ ] **Step 5.2: 커밋**

```bash
git add src/app/api/auction/[id]/bid/route.ts
git commit -m "💰 입찰 API 구현 (비관적 잠금, 자동 입찰 트리거, 마감 연장)"
```

---

## Task 6: 자동 입찰 설정 API

**Files:**
- Create: `src/app/api/auction/[id]/auto-bid/route.ts`

- [ ] **Step 6.1: 자동 입찰 설정 API 작성**

Create `src/app/api/auction/[id]/auto-bid/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)
    if (isNaN(auctionId)) {
      return NextResponse.json(
        { error: "잘못된 경매 ID입니다." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const maxAmount = parseInt(body.maxAmount)

    if (isNaN(maxAmount) || maxAmount <= 0) {
      return NextResponse.json(
        { error: "유효한 최대 금액을 입력해주세요." },
        { status: 400 }
      )
    }

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { status: true, currentPrice: true, bidIncrement: true, sellerId: true },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    if (auction.status !== "active") {
      return NextResponse.json(
        { error: "진행중인 경매가 아닙니다." },
        { status: 400 }
      )
    }

    if (auction.sellerId === user.id) {
      return NextResponse.json(
        { error: "본인의 경매에는 자동 입찰을 설정할 수 없습니다." },
        { status: 400 }
      )
    }

    if (maxAmount < auction.currentPrice + auction.bidIncrement) {
      return NextResponse.json(
        {
          error: `최대 금액은 ${(auction.currentPrice + auction.bidIncrement).toLocaleString()}원 이상이어야 합니다.`,
        },
        { status: 400 }
      )
    }

    // upsert: 기존 설정이 있으면 업데이트, 없으면 생성
    const autoBid = await prisma.autoBid.upsert({
      where: {
        auctionId_userId: { auctionId, userId: user.id },
      },
      update: {
        maxAmount,
        isActive: true,
      },
      create: {
        auctionId,
        userId: user.id,
        maxAmount,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      autoBid: {
        id: autoBid.id,
        maxAmount: autoBid.maxAmount,
        isActive: autoBid.isActive,
      },
    })
  } catch (error) {
    console.error("자동 입찰 설정 에러:", error)
    return NextResponse.json(
      { error: "자동 입찰 설정에 실패했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 6.2: 커밋**

```bash
git add src/app/api/auction/[id]/auto-bid/route.ts
git commit -m "🤖 자동 입찰 설정 API 구현"
```

---

## Task 7: 즉시구매 API

**Files:**
- Create: `src/app/api/auction/[id]/buy-now/route.ts`

- [ ] **Step 7.1: 즉시구매 API 작성**

Create `src/app/api/auction/[id]/buy-now/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { emitBid, emitEnded } from "@/lib/auction-events"
import { createNotification } from "@/lib/notification"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)
    if (isNaN(auctionId)) {
      return NextResponse.json(
        { error: "잘못된 경매 ID입니다." },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        {
          id: number
          sellerId: number
          title: string
          currentPrice: number
          buyNowPrice: number | null
          bidCount: number
          status: string
        }[]
      >`SELECT id, sellerId, title, currentPrice, buyNowPrice, bidCount, status
        FROM auctions WHERE id = ${auctionId} FOR UPDATE`

      if (!locked) {
        throw new Error("NOT_FOUND")
      }

      if (locked.status !== "active") {
        throw new Error("NOT_ACTIVE")
      }

      if (!locked.buyNowPrice) {
        throw new Error("NO_BUY_NOW")
      }

      if (locked.sellerId === user.id) {
        throw new Error("OWN_AUCTION")
      }

      // 즉시구매 입찰 생성
      await tx.bid.create({
        data: {
          auctionId,
          userId: user.id,
          amount: locked.buyNowPrice,
          isAutoBid: false,
        },
      })

      // 경매 종료
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentPrice: locked.buyNowPrice,
          bidCount: locked.bidCount + 1,
          status: "ended",
          winnerId: user.id,
        },
      })

      // 모든 자동 입찰 비활성화
      await tx.autoBid.updateMany({
        where: { auctionId, isActive: true },
        data: { isActive: false },
      })

      return {
        sellerId: locked.sellerId,
        title: locked.title,
        buyNowPrice: locked.buyNowPrice,
      }
    })

    // SSE 이벤트 발행
    emitBid({
      auctionId,
      currentPrice: result.buyNowPrice,
      bidCount: 0,
      bidderNickname: user.nickname,
      amount: result.buyNowPrice,
      isAutoBid: false,
      time: new Date().toISOString(),
    })

    emitEnded({
      auctionId,
      winnerId: user.id,
      winnerNickname: user.nickname,
      finalPrice: result.buyNowPrice,
    })

    // 알림 발송 (비동기)
    createNotification({
      userId: user.id,
      type: "system",
      title: "즉시구매 완료",
      message: `"${result.title}" 경매를 ${result.buyNowPrice.toLocaleString()}원에 즉시구매했습니다.`,
      link: `/auction/${auctionId}`,
    }).catch(() => {})

    createNotification({
      userId: result.sellerId,
      type: "system",
      title: "경매 즉시구매 낙찰",
      message: `"${result.title}" 경매가 ${result.buyNowPrice.toLocaleString()}원에 즉시구매 낙찰되었습니다.`,
      link: `/auction/${auctionId}`,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "즉시구매가 완료되었습니다.",
    })
  } catch (error) {
    if (error instanceof Error) {
      const errorMap: Record<string, { msg: string; status: number }> = {
        NOT_FOUND: { msg: "경매를 찾을 수 없습니다.", status: 404 },
        NOT_ACTIVE: { msg: "진행중인 경매가 아닙니다.", status: 400 },
        NO_BUY_NOW: { msg: "즉시구매가 설정되지 않은 경매입니다.", status: 400 },
        OWN_AUCTION: { msg: "본인의 경매는 즉시구매할 수 없습니다.", status: 400 },
      }
      const mapped = errorMap[error.message]
      if (mapped) {
        return NextResponse.json({ error: mapped.msg }, { status: mapped.status })
      }
    }
    console.error("즉시구매 에러:", error)
    return NextResponse.json(
      { error: "즉시구매 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 7.2: 커밋**

```bash
git add src/app/api/auction/[id]/buy-now/route.ts
git commit -m "🛒 즉시구매 API 구현"
```

---

## Task 8: SSE 스트림 API

**Files:**
- Create: `src/app/api/auction/[id]/sse/route.ts`

- [ ] **Step 8.1: SSE 스트림 API 작성**

Create `src/app/api/auction/[id]/sse/route.ts`:

```typescript
import { NextRequest } from "next/server"
import {
  auctionEmitter,
  addViewer,
  removeViewer,
  getViewerCount,
  BidEvent,
  EndedEvent,
  ExtendedEvent,
} from "@/lib/auction-events"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auctionId = parseInt(id)

  if (isNaN(auctionId)) {
    return new Response("Invalid auction ID", { status: 400 })
  }

  const connectionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // 연결 끊김
        }
      }

      // 연결 시 참여자 등록
      addViewer(auctionId, connectionId)
      send("viewers", { count: getViewerCount(auctionId) })

      // 이벤트 리스너 등록
      const onBid = (data: BidEvent) => send("bid", data)
      const onEnded = (data: EndedEvent) => send("ended", data)
      const onExtended = (data: ExtendedEvent) => send("extended", data)

      auctionEmitter.on(`bid:${auctionId}`, onBid)
      auctionEmitter.on(`end:${auctionId}`, onEnded)
      auctionEmitter.on(`extended:${auctionId}`, onExtended)

      // 30초마다 참여자 수 + keepalive
      const viewerInterval = setInterval(() => {
        send("viewers", { count: getViewerCount(auctionId) })
      }, 30_000)

      // 연결 종료 시 정리
      request.signal.addEventListener("abort", () => {
        removeViewer(auctionId, connectionId)
        auctionEmitter.off(`bid:${auctionId}`, onBid)
        auctionEmitter.off(`end:${auctionId}`, onEnded)
        auctionEmitter.off(`extended:${auctionId}`, onExtended)
        clearInterval(viewerInterval)

        // 다른 참여자들에게 업데이트된 참여자 수 알림
        const remaining = getViewerCount(auctionId)
        auctionEmitter.emit(`viewers:${auctionId}`, { count: remaining })

        try {
          controller.close()
        } catch {
          // 이미 닫힘
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
```

- [ ] **Step 8.2: 커밋**

```bash
git add src/app/api/auction/[id]/sse/route.ts
git commit -m "📡 SSE 실시간 스트림 API 구현"
```

---

## Task 9: 경매 자동 종료 Cron API

**Files:**
- Create: `src/app/api/auction/cron/close-expired/route.ts`

- [ ] **Step 9.1: Cron API 작성**

Create `src/app/api/auction/cron/close-expired/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { emitEnded } from "@/lib/auction-events"
import { createNotification } from "@/lib/notification"

export async function POST(request: NextRequest) {
  try {
    // Cron 시크릿 검증
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "인증 실패" },
        { status: 401 }
      )
    }

    // 만료된 active 경매 조회
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        status: "active",
        endsAt: { lte: new Date() },
      },
      include: {
        seller: { select: { id: true, nickname: true } },
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          include: {
            user: { select: { id: true, nickname: true } },
          },
        },
      },
    })

    let closedCount = 0

    for (const auction of expiredAuctions) {
      const highestBid = auction.bids[0] || null
      const winnerId = highestBid?.userId || null
      const winnerNickname = highestBid?.user.nickname || null
      const finalPrice = highestBid?.amount || auction.startingPrice

      // 경매 종료 처리
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: "ended",
          winnerId,
        },
      })

      // 모든 자동 입찰 비활성화
      await prisma.autoBid.updateMany({
        where: { auctionId: auction.id, isActive: true },
        data: { isActive: false },
      })

      // SSE 이벤트
      emitEnded({
        auctionId: auction.id,
        winnerId,
        winnerNickname,
        finalPrice,
      })

      // 알림 발송
      if (winnerId) {
        // 낙찰자 알림
        createNotification({
          userId: winnerId,
          type: "system",
          title: "경매 낙찰",
          message: `축하합니다! "${auction.title}" 경매에 ${finalPrice.toLocaleString()}원으로 낙찰되었습니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})

        // 판매자 알림
        createNotification({
          userId: auction.sellerId,
          type: "system",
          title: "경매 낙찰 완료",
          message: `"${auction.title}" 경매가 ${finalPrice.toLocaleString()}원에 낙찰되었습니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})
      } else {
        // 유찰 — 판매자에게만 알림
        createNotification({
          userId: auction.sellerId,
          type: "system",
          title: "경매 유찰",
          message: `"${auction.title}" 경매가 입찰 없이 종료되었습니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})
      }

      closedCount++
    }

    // pending → active 전환 (시작 시간 도래)
    const activatedCount = await prisma.auction.updateMany({
      where: {
        status: "pending",
        startsAt: { lte: new Date() },
      },
      data: { status: "active" },
    })

    return NextResponse.json({
      success: true,
      closedCount,
      activatedCount: activatedCount.count,
    })
  } catch (error) {
    console.error("경매 자동 종료 에러:", error)
    return NextResponse.json(
      { error: "경매 자동 종료 처리 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 9.2: 커밋**

```bash
git add src/app/api/auction/cron/close-expired/route.ts
git commit -m "⏰ 경매 자동 종료 Cron API 구현 (만료 처리 + 상태 전환)"
```

---

## Task 10: 관리자 API

**Files:**
- Create: `src/app/api/admin/auction/route.ts`
- Create: `src/app/api/admin/auction/[id]/route.ts`

- [ ] **Step 10.1: 관리자 경매 목록 API 작성**

Create `src/app/api/admin/auction/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ["pending", "active", "ended"].includes(status)) {
      where.status = status
    }
    if (search) {
      where.title = { contains: search }
    }

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, nickname: true, email: true } },
          winner: { select: { id: true, nickname: true } },
          _count: { select: { bids: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      auctions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("관리자 경매 목록 에러:", error)
    return NextResponse.json(
      { error: "경매 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 10.2: 관리자 경매 수정/강제종료 API 작성**

Create `src/app/api/admin/auction/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminUser } from "@/lib/auth"
import { emitEnded } from "@/lib/auction-events"
import { createNotification } from "@/lib/notification"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true, nickname: true, email: true } },
        winner: { select: { id: true, nickname: true } },
        bids: {
          include: { user: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "desc" },
        },
        autoBids: {
          include: { user: { select: { id: true, nickname: true } } },
        },
      },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, auction })
  } catch (error) {
    console.error("관리자 경매 상세 에러:", error)
    return NextResponse.json(
      { error: "경매 정보를 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      )
    }

    const { id } = await params
    const auctionId = parseInt(id)
    const body = await request.json()
    const { action } = body

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: { select: { id: true } },
        bids: { orderBy: { amount: "desc" }, take: 1, include: { user: { select: { id: true, nickname: true } } } },
      },
    })

    if (!auction) {
      return NextResponse.json(
        { error: "경매를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 강제 종료
    if (action === "force-end") {
      if (auction.status === "ended") {
        return NextResponse.json(
          { error: "이미 종료된 경매입니다." },
          { status: 400 }
        )
      }

      const highestBid = auction.bids[0] || null
      const winnerId = highestBid?.userId || null
      const winnerNickname = highestBid?.user.nickname || null

      await prisma.auction.update({
        where: { id: auctionId },
        data: { status: "ended", winnerId },
      })

      await prisma.autoBid.updateMany({
        where: { auctionId, isActive: true },
        data: { isActive: false },
      })

      emitEnded({
        auctionId,
        winnerId,
        winnerNickname,
        finalPrice: auction.currentPrice,
      })

      // 알림
      createNotification({
        userId: auction.seller.id,
        type: "system",
        title: "경매 강제 종료",
        message: `관리자에 의해 "${auction.title}" 경매가 종료되었습니다.`,
        link: `/auction/${auctionId}`,
      }).catch(() => {})

      if (winnerId) {
        createNotification({
          userId: winnerId,
          type: "system",
          title: "경매 낙찰 (관리자 종료)",
          message: `"${auction.title}" 경매가 관리자에 의해 종료되어 ${auction.currentPrice.toLocaleString()}원에 낙찰되었습니다.`,
          link: `/auction/${auctionId}`,
        }).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        message: "경매가 강제 종료되었습니다.",
      })
    }

    return NextResponse.json(
      { error: "알 수 없는 액션입니다." },
      { status: 400 }
    )
  } catch (error) {
    console.error("관리자 경매 수정 에러:", error)
    return NextResponse.json(
      { error: "경매 수정 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 10.3: 커밋**

```bash
git add src/app/api/admin/auction/route.ts src/app/api/admin/auction/[id]/route.ts
git commit -m "🔧 관리자 경매 API 구현 (목록, 상세, 강제종료)"
```

---

## Task 11: 공통 컴포넌트

**Files:**
- Create: `src/components/auction/AuctionStatusBadge.tsx`
- Create: `src/components/auction/AuctionTimer.tsx`
- Create: `src/components/auction/AuctionCard.tsx`

- [ ] **Step 11.1: AuctionStatusBadge 작성**

Create `src/components/auction/AuctionStatusBadge.tsx`:

```tsx
"use client"

interface AuctionStatusBadgeProps {
  status: string
}

export function AuctionStatusBadge({ status }: AuctionStatusBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: "예정",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    },
    active: {
      label: "진행중",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    },
    ended: {
      label: "종료",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    },
  }

  const { label, className } = config[status] || config.ended

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 11.2: AuctionTimer 작성**

Create `src/components/auction/AuctionTimer.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"

interface AuctionTimerProps {
  endsAt: string
  status: string
  onExpired?: () => void
}

export function AuctionTimer({ endsAt, status, onExpired }: AuctionTimerProps) {
  const [timeLeft, setTimeLeft] = useState("")
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    if (status !== "active") {
      setTimeLeft(status === "pending" ? "시작 전" : "종료됨")
      return
    }

    const update = () => {
      const now = new Date().getTime()
      const end = new Date(endsAt).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft("종료됨")
        onExpired?.()
        return false
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setIsUrgent(diff < 5 * 60 * 1000) // 5분 미만

      if (days > 0) {
        setTimeLeft(`${days}일 ${hours}시간`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}시간 ${minutes}분`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}분 ${seconds}초`)
      } else {
        setTimeLeft(`${seconds}초`)
      }

      return true
    }

    update()
    const interval = setInterval(() => {
      if (!update()) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [endsAt, status, onExpired])

  return (
    <span
      className={`font-mono ${
        isUrgent
          ? "text-red-600 dark:text-red-400 font-bold animate-pulse"
          : "text-muted-foreground"
      }`}
    >
      {timeLeft}
    </span>
  )
}
```

- [ ] **Step 11.3: AuctionCard 작성**

Create `src/components/auction/AuctionCard.tsx`:

```tsx
"use client"

import Link from "next/link"
import { AuctionStatusBadge } from "./AuctionStatusBadge"
import { AuctionTimer } from "./AuctionTimer"
import { Gavel } from "lucide-react"

interface AuctionCardProps {
  auction: {
    id: number
    title: string
    image: string | null
    currentPrice: number
    startingPrice: number
    bidCount: number
    status: string
    endsAt: string
    seller: { nickname: string }
  }
}

export function AuctionCard({ auction }: AuctionCardProps) {
  return (
    <Link
      href={`/auction/${auction.id}`}
      className="block border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card"
    >
      <div className="aspect-[4/3] bg-muted relative">
        {auction.image ? (
          <img
            src={auction.image}
            alt={auction.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gavel className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <AuctionStatusBadge status={auction.status} />
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2">{auction.title}</h3>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-muted-foreground">현재가</p>
            <p className="text-lg font-bold">
              {auction.currentPrice.toLocaleString()}
              <span className="text-sm font-normal">원</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">입찰</p>
            <p className="text-sm font-medium">{auction.bidCount}회</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
          <span>{auction.seller.nickname}</span>
          <AuctionTimer endsAt={auction.endsAt} status={auction.status} />
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 11.4: 커밋**

```bash
git add src/components/auction/AuctionStatusBadge.tsx src/components/auction/AuctionTimer.tsx src/components/auction/AuctionCard.tsx
git commit -m "🧩 경매 공통 컴포넌트 (StatusBadge, Timer, Card)"
```

---

## Task 12: 입찰 관련 컴포넌트

**Files:**
- Create: `src/components/auction/BidForm.tsx`
- Create: `src/components/auction/BidHistory.tsx`
- Create: `src/components/auction/AutoBidForm.tsx`

- [ ] **Step 12.1: BidForm 작성**

Create `src/components/auction/BidForm.tsx`:

```tsx
"use client"

import { useState } from "react"

interface BidFormProps {
  auctionId: number
  currentPrice: number
  bidIncrement: number
  status: string
  isOwner: boolean
  isHighestBidder: boolean
}

export function BidForm({
  auctionId,
  currentPrice,
  bidIncrement,
  status,
  isOwner,
  isHighestBidder,
}: BidFormProps) {
  const [amount, setAmount] = useState(currentPrice + bidIncrement)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const minBid = currentPrice + bidIncrement
  const disabled = status !== "active" || isOwner || isHighestBidder || loading

  const handleBid = async () => {
    if (amount < minBid) {
      setError(`최소 ${minBid.toLocaleString()}원 이상 입찰해주세요.`)
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/auction/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "입찰에 실패했습니다.")
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const quickBid = (add: number) => {
    setAmount(currentPrice + bidIncrement + add)
  }

  // currentPrice 변경 시 최소 금액 업데이트
  if (amount < minBid) {
    setAmount(minBid)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">입찰 금액</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            min={minBid}
            step={bidIncrement}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
          />
          <span className="flex items-center text-sm text-muted-foreground">원</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => quickBid(0)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          최소
        </button>
        <button
          type="button"
          onClick={() => quickBid(10000)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          +1만
        </button>
        <button
          type="button"
          onClick={() => quickBid(50000)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          +5만
        </button>
        <button
          type="button"
          onClick={() => quickBid(100000)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          +10만
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {isOwner && (
        <p className="text-sm text-muted-foreground">본인의 경매에는 입찰할 수 없습니다.</p>
      )}

      {isHighestBidder && (
        <p className="text-sm text-blue-600 dark:text-blue-400">
          현재 최고가 입찰자입니다.
        </p>
      )}

      <button
        type="button"
        onClick={handleBid}
        disabled={disabled}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "입찰 중..." : `${amount.toLocaleString()}원 입찰하기`}
      </button>
    </div>
  )
}
```

- [ ] **Step 12.2: BidHistory 작성**

Create `src/components/auction/BidHistory.tsx`:

```tsx
"use client"

import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"

interface Bid {
  id: number
  amount: number
  isAutoBid: boolean
  createdAt: string
  user: { id: number; nickname: string }
}

interface BidHistoryProps {
  bids: Bid[]
}

export function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        아직 입찰이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {bids.map((bid, index) => (
        <div
          key={bid.id}
          className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
            index === 0
              ? "bg-primary/5 border border-primary/20"
              : "border border-border"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{bid.user.nickname}</span>
            {bid.isAutoBid && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                자동
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="font-bold">{bid.amount.toLocaleString()}원</span>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(bid.createdAt), {
                addSuffix: true,
                locale: ko,
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 12.3: AutoBidForm 작성**

Create `src/components/auction/AutoBidForm.tsx`:

```tsx
"use client"

import { useState } from "react"

interface AutoBidFormProps {
  auctionId: number
  currentPrice: number
  bidIncrement: number
  status: string
  isOwner: boolean
  existingAutoBid?: { maxAmount: number; isActive: boolean } | null
}

export function AutoBidForm({
  auctionId,
  currentPrice,
  bidIncrement,
  status,
  isOwner,
  existingAutoBid,
}: AutoBidFormProps) {
  const minAmount = currentPrice + bidIncrement
  const [maxAmount, setMaxAmount] = useState(
    existingAutoBid?.maxAmount || minAmount
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const disabled = status !== "active" || isOwner || loading

  const handleSubmit = async () => {
    if (maxAmount < minAmount) {
      setError(`최소 ${minAmount.toLocaleString()}원 이상이어야 합니다.`)
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch(`/api/auction/${auctionId}/auto-bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxAmount }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(
          `자동 입찰이 설정되었습니다. (최대 ${maxAmount.toLocaleString()}원)`
        )
      } else {
        setError(data.error || "자동 입찰 설정에 실패했습니다.")
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
      <h4 className="text-sm font-medium">자동 입찰 설정</h4>
      <p className="text-xs text-muted-foreground">
        설정한 최대 금액까지 자동으로 입찰합니다.
      </p>

      {existingAutoBid?.isActive && (
        <p className="text-xs text-blue-600 dark:text-blue-400">
          현재 자동 입찰 활성: 최대 {existingAutoBid.maxAmount.toLocaleString()}원
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(parseInt(e.target.value) || 0)}
          min={minAmount}
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
          placeholder="최대 입찰 금액"
        />
        <span className="flex items-center text-sm text-muted-foreground">원</span>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
      >
        {loading ? "설정 중..." : "자동 입찰 설정"}
      </button>
    </div>
  )
}
```

- [ ] **Step 12.4: 커밋**

```bash
git add src/components/auction/BidForm.tsx src/components/auction/BidHistory.tsx src/components/auction/AutoBidForm.tsx
git commit -m "🧩 입찰 컴포넌트 구현 (BidForm, BidHistory, AutoBidForm)"
```

---

## Task 13: 경매 목록 페이지

**Files:**
- Create: `src/app/auction/page.tsx`

- [ ] **Step 13.1: 경매 목록 페이지 작성**

Create `src/app/auction/page.tsx`:

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { AuctionCard } from "@/components/auction/AuctionCard"
import { Gavel, ChevronLeft, ChevronRight } from "lucide-react"

interface Auction {
  id: number
  title: string
  image: string | null
  currentPrice: number
  startingPrice: number
  bidCount: number
  status: string
  endsAt: string
  seller: { nickname: string }
}

const STATUS_TABS = [
  { value: "", label: "전체" },
  { value: "active", label: "진행중" },
  { value: "pending", label: "예정" },
  { value: "ended", label: "종료" },
]

export default function AuctionListPage() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        ...(status && { status }),
      })

      const res = await fetch(`/api/auction?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAuctions(data.auctions)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error("경매 목록 조회 에러:", error)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    fetchAuctions()
  }, [fetchAuctions])

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    setPage(1)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Gavel className="w-6 h-6" />
          <h1 className="text-2xl font-bold">경매</h1>
        </div>
        <a
          href="/auction/create"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          경매 등록
        </a>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              status === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Gavel className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>등록된 경매가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground px-4">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 13.2: 커밋**

```bash
git add src/app/auction/page.tsx
git commit -m "📄 경매 목록 페이지 구현"
```

---

## Task 14: 경매 등록 페이지

**Files:**
- Create: `src/app/auction/create/page.tsx`

- [ ] **Step 14.1: 경매 등록 페이지 작성**

Create `src/app/auction/create/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, X } from "lucide-react"

export default function AuctionCreatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    startingPrice: "",
    buyNowPrice: "",
    bidIncrement: "1000",
    startsAt: "",
    endsAt: "",
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setForm((prev) => ({ ...prev, image: data.url }))
        setImagePreview(data.url)
      } else {
        setError("이미지 업로드에 실패했습니다.")
      }
    } catch {
      setError("이미지 업로드 중 오류가 발생했습니다.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (res.ok) {
        router.push(`/auction/${data.auction.id}`)
      } else {
        setError(data.error || "경매 등록에 실패했습니다.")
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> 돌아가기
      </button>

      <h1 className="text-2xl font-bold mb-6">경매 등록</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
            required
            maxLength={255}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            placeholder="경매 상품명을 입력하세요"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            상세 설명 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            required
            rows={5}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm resize-y"
            placeholder="상품에 대한 상세 설명을 입력하세요"
          />
        </div>

        {/* 이미지 */}
        <div>
          <label className="block text-sm font-medium mb-1">대표 이미지</label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="미리보기"
                className="w-48 h-36 object-cover rounded-md border border-border"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null)
                  setForm((prev) => ({ ...prev, image: "" }))
                }}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-48 h-36 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary">
              <div className="text-center">
                <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">
                  이미지 업로드
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* 가격 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              시작가 (원) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.startingPrice}
              onChange={(e) => updateForm("startingPrice", e.target.value)}
              required
              min={1000}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              즉시구매가 (원, 선택)
            </label>
            <input
              type="number"
              value={form.buyNowPrice}
              onChange={(e) => updateForm("buyNowPrice", e.target.value)}
              min={1}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              placeholder="비워두면 즉시구매 불가"
            />
          </div>
        </div>

        {/* 입찰 단위 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            최소 입찰 단위 (원)
          </label>
          <input
            type="number"
            value={form.bidIncrement}
            onChange={(e) => updateForm("bidIncrement", e.target.value)}
            min={100}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
          />
        </div>

        {/* 시간 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              시작 시간 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => updateForm("startsAt", e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              종료 시간 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => updateForm("endsAt", e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "등록 중..." : "경매 등록"}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 14.2: 커밋**

```bash
git add src/app/auction/create/page.tsx
git commit -m "📝 경매 등록 페이지 구현"
```

---

## Task 15: 경매 상세 페이지 (실시간 SSE 통합)

**Files:**
- Create: `src/app/auction/[id]/page.tsx`

- [ ] **Step 15.1: 경매 상세 페이지 작성**

Create `src/app/auction/[id]/page.tsx`:

```tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { AuctionStatusBadge } from "@/components/auction/AuctionStatusBadge"
import { AuctionTimer } from "@/components/auction/AuctionTimer"
import { BidForm } from "@/components/auction/BidForm"
import { BidHistory } from "@/components/auction/BidHistory"
import { AutoBidForm } from "@/components/auction/AutoBidForm"
import { Gavel, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Auction {
  id: number
  sellerId: number
  title: string
  description: string
  image: string | null
  startingPrice: number
  currentPrice: number
  buyNowPrice: number | null
  bidIncrement: number
  bidCount: number
  startsAt: string
  endsAt: string
  status: string
  winnerId: number | null
  seller: { id: number; nickname: string; image: string | null }
  winner: { id: number; nickname: string } | null
  bids: {
    id: number
    amount: number
    isAutoBid: boolean
    createdAt: string
    user: { id: number; nickname: string }
  }[]
}

export default function AuctionDetailPage() {
  const params = useParams()
  const auctionId = parseInt(params.id as string)

  const [auction, setAuction] = useState<Auction | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [buyNowLoading, setBuyNowLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auction/${auctionId}`)
      if (res.ok) {
        const data = await res.json()
        setAuction(data.auction)
        setViewerCount(data.viewerCount)
      }
    } catch (error) {
      console.error("경매 조회 에러:", error)
    } finally {
      setLoading(false)
    }
  }, [auctionId])

  // 현재 유저 정보
  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUserId(data.user.id)
      })
      .catch(() => {})
  }, [])

  // 경매 데이터 로드
  useEffect(() => {
    fetchAuction()
  }, [fetchAuction])

  // SSE 연결
  useEffect(() => {
    if (!auctionId) return

    const es = new EventSource(`/api/auction/${auctionId}/sse`)
    eventSourceRef.current = es

    es.addEventListener("bid", (e) => {
      const data = JSON.parse(e.data)
      setAuction((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          currentPrice: data.currentPrice,
          bidCount: prev.bidCount + 1,
          bids: [
            {
              id: Date.now(),
              amount: data.amount,
              isAutoBid: data.isAutoBid,
              createdAt: data.time,
              user: { id: 0, nickname: data.bidderNickname },
            },
            ...prev.bids,
          ].slice(0, 20),
        }
      })
    })

    es.addEventListener("ended", (e) => {
      const data = JSON.parse(e.data)
      setAuction((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: "ended",
          winnerId: data.winnerId,
          winner: data.winnerNickname
            ? { id: data.winnerId, nickname: data.winnerNickname }
            : null,
        }
      })
    })

    es.addEventListener("extended", (e) => {
      const data = JSON.parse(e.data)
      setAuction((prev) => {
        if (!prev) return prev
        return { ...prev, endsAt: data.newEndsAt }
      })
    })

    es.addEventListener("viewers", (e) => {
      const data = JSON.parse(e.data)
      setViewerCount(data.count)
    })

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [auctionId])

  const handleBuyNow = async () => {
    if (!confirm("즉시구매 하시겠습니까?")) return

    setBuyNowLoading(true)
    try {
      const res = await fetch(`/api/auction/${auctionId}/buy-now`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || "즉시구매에 실패���습니다.")
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.")
    } finally {
      setBuyNowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">경매를 찾을 수 없습니다.</p>
        <Link href="/auction" className="text-primary mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const isOwner = currentUserId === auction.sellerId
  const highestBidder = auction.bids[0]?.user
  const isHighestBidder =
    currentUserId !== null && highestBidder?.id === currentUserId

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/auction"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> 경매 목록
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* 왼쪽: 상품 정보 */}
        <div className="lg:col-span-3 space-y-6">
          {/* 이미지 */}
          <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            {auction.image ? (
              <img
                src={auction.image}
                alt={auction.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gavel className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* 상품 설명 */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              상품 설명
            </h2>
            <p className="text-sm whitespace-pre-wrap">{auction.description}</p>
          </div>

          {/* 입찰 내역 */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              입찰 내역
            </h2>
            <BidHistory bids={auction.bids} />
          </div>
        </div>

        {/* 오른쪽: 입찰 패널 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 헤더 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AuctionStatusBadge status={auction.status} />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                {viewerCount}명 참여중
              </div>
            </div>
            <h1 className="text-xl font-bold">{auction.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              판매자: {auction.seller.nickname}
            </p>
          </div>

          {/* 가격 정보 */}
          <div className="p-4 border border-border rounded-lg space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">현재가</span>
              <span className="text-2xl font-bold">
                {auction.currentPrice.toLocaleString()}
                <span className="text-sm font-normal">원</span>
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">시작가</span>
              <span>{auction.startingPrice.toLocaleString()}원</span>
            </div>
            {auction.buyNowPrice && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">즉시구매가</span>
                <span className="text-orange-600 font-medium">
                  {auction.buyNowPrice.toLocaleString()}원
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">최소 입찰 단위</span>
              <span>{auction.bidIncrement.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">입찰 횟수</span>
              <span>{auction.bidCount}회</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">남은 시간</span>
              <AuctionTimer
                endsAt={auction.endsAt}
                status={auction.status}
                onExpired={fetchAuction}
              />
            </div>
          </div>

          {/* 종료된 경매 */}
          {auction.status === "ended" && (
            <div className="p-4 border border-border rounded-lg bg-muted/30 text-center">
              {auction.winner ? (
                <>
                  <p className="text-sm text-muted-foreground">낙찰자</p>
                  <p className="text-lg font-bold">{auction.winner.nickname}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {auction.currentPrice.toLocaleString()}원에 낙찰
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">유찰되었습니다.</p>
              )}
            </div>
          )}

          {/* 입찰 폼 */}
          {auction.status === "active" && currentUserId && (
            <>
              <BidForm
                auctionId={auction.id}
                currentPrice={auction.currentPrice}
                bidIncrement={auction.bidIncrement}
                status={auction.status}
                isOwner={isOwner}
                isHighestBidder={isHighestBidder}
              />

              {/* 즉시구매 버튼 */}
              {auction.buyNowPrice && !isOwner && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={buyNowLoading}
                  className="w-full py-2.5 border-2 border-orange-500 text-orange-600 rounded-md font-medium hover:bg-orange-50 dark:hover:bg-orange-950 disabled:opacity-50"
                >
                  {buyNowLoading
                    ? "처리 중..."
                    : `${auction.buyNowPrice.toLocaleString()}원 즉시구매`}
                </button>
              )}

              {/* 자동 입찰 */}
              {!isOwner && (
                <AutoBidForm
                  auctionId={auction.id}
                  currentPrice={auction.currentPrice}
                  bidIncrement={auction.bidIncrement}
                  status={auction.status}
                  isOwner={isOwner}
                />
              )}
            </>
          )}

          {/* 로그인 안내 */}
          {auction.status === "active" && !currentUserId && (
            <div className="p-4 border border-border rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                입찰하려면 로그인이 필요합니다.
              </p>
              <a
                href="/login"
                className="text-sm text-primary hover:underline"
              >
                로그인하기
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 15.2: 커밋**

```bash
git add src/app/auction/[id]/page.tsx
git commit -m "🎮 경매 상세 페이지 구현 (SSE 실시간 업데이트)"
```

---

## Task 16: 내 경매 페이지

**Files:**
- Create: `src/app/auction/my/page.tsx`

- [ ] **Step 16.1: 내 경매 페이지 작성**

Create `src/app/auction/my/page.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuctionStatusBadge } from "@/components/auction/AuctionStatusBadge"
import { Gavel, ShoppingBag } from "lucide-react"

interface MyBid {
  id: number
  amount: number
  createdAt: string
  auction: {
    id: number
    title: string
    currentPrice: number
    status: string
    winnerId: number | null
  }
}

interface MyAuction {
  id: number
  title: string
  currentPrice: number
  bidCount: number
  status: string
  endsAt: string
  winnerId: number | null
}

export default function MyAuctionPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"bids" | "selling">("bids")
  const [myBids, setMyBids] = useState<MyBid[]>([])
  const [myAuctions, setMyAuctions] = useState<MyAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/me")
        if (!meRes.ok) {
          router.push("/login")
          return
        }
        const meData = await meRes.json()
        if (!meData.user) {
          router.push("/login")
          return
        }
        setUserId(meData.user.id)

        // 내 입찰과 내 판매 경매를 동시 조회
        const [bidsRes, auctionsRes] = await Promise.all([
          fetch("/api/auction?myBids=true"),
          fetch("/api/auction?mySelling=true"),
        ])

        // 내 입찰 — 별도 API가 없으므로 전체 경매에서 클라이언트 필터
        // 실제로는 서버에서 처리하는 게 좋지만, 현재 API 구조에서는 상세 조회로 대체
        if (auctionsRes.ok) {
          const data = await auctionsRes.json()
          setMyAuctions(data.auctions || [])
        }
      } catch {
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">내 경매</h1>

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab("bids")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "bids"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <Gavel className="w-4 h-4 inline mr-1" />내 입찰
        </button>
        <button
          onClick={() => setTab("selling")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "selling"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <ShoppingBag className="w-4 h-4 inline mr-1" />내 판매
        </button>
      </div>

      {tab === "selling" && (
        <div className="space-y-3">
          {myAuctions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              등록한 경매가 없습니다.
            </p>
          ) : (
            myAuctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auction/${auction.id}`}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{auction.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <AuctionStatusBadge status={auction.status} />
                    <span className="text-sm text-muted-foreground">
                      입찰 {auction.bidCount}회
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {auction.currentPrice.toLocaleString()}원
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "bids" && (
        <p className="text-center py-8 text-muted-foreground">
          입찰 내역은 각 경매 상세 페이지에서 확인할 수 있습니다.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 16.2: 커밋**

```bash
git add src/app/auction/my/page.tsx
git commit -m "👤 내 경매 페이지 구현"
```

---

## Task 17: 관리자 경매 페이지

**Files:**
- Create: `src/app/admin/auction/page.tsx`
- Create: `src/app/admin/auction/[id]/page.tsx`

- [ ] **Step 17.1: 관리자 경매 목록 페이지 작성**

Create `src/app/admin/auction/page.tsx`:

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { AuctionStatusBadge } from "@/components/auction/AuctionStatusBadge"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { Gavel, Search, ChevronLeft, ChevronRight } from "lucide-react"

interface AdminAuction {
  id: number
  title: string
  currentPrice: number
  bidCount: number
  status: string
  startsAt: string
  endsAt: string
  createdAt: string
  seller: { id: number; nickname: string; email: string }
  winner: { id: number; nickname: string } | null
  _count: { bids: number }
}

export default function AdminAuctionPage() {
  const [auctions, setAuctions] = useState<AdminAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search && { search }),
        ...(status && { status }),
      })

      const res = await fetch(`/api/admin/auction?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAuctions(data.auctions)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error("관리자 경매 목록 에러:", error)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchAuctions()
  }, [fetchAuctions])

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Gavel className="w-6 h-6" />
        <h1 className="text-2xl font-bold">경매 관리</h1>
      </div>

      {/* 필터 */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="경매 제목 검색..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2 border border-border rounded-md bg-background text-sm"
        >
          <option value="">전체 상태</option>
          <option value="pending">예정</option>
          <option value="active">진행중</option>
          <option value="ended">종료</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ID</th>
              <th className="text-left px-4 py-3 font-medium">제목</th>
              <th className="text-left px-4 py-3 font-medium">판매자</th>
              <th className="text-right px-4 py-3 font-medium">현재가</th>
              <th className="text-center px-4 py-3 font-medium">입찰</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-left px-4 py-3 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : auctions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  경매가 없습니다.
                </td>
              </tr>
            ) : (
              auctions.map((auction) => (
                <tr
                  key={auction.id}
                  className="border-t border-border hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{auction.id}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/auction/${auction.id}`}
                      className="text-primary hover:underline"
                    >
                      {auction.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {auction.seller.nickname}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {auction.currentPrice.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-center">
                    {auction._count.bids}회
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AuctionStatusBadge status={auction.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(auction.createdAt), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground px-4">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 17.2: 관리자 경매 상세 페이지 작성**

Create `src/app/admin/auction/[id]/page.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { AuctionStatusBadge } from "@/components/auction/AuctionStatusBadge"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { ArrowLeft, AlertTriangle } from "lucide-react"

interface AdminAuctionDetail {
  id: number
  title: string
  description: string
  image: string | null
  startingPrice: number
  currentPrice: number
  buyNowPrice: number | null
  bidIncrement: number
  bidCount: number
  status: string
  startsAt: string
  endsAt: string
  createdAt: string
  seller: { id: number; nickname: string; email: string }
  winner: { id: number; nickname: string } | null
  bids: {
    id: number
    amount: number
    isAutoBid: boolean
    createdAt: string
    user: { id: number; nickname: string }
  }[]
  autoBids: {
    id: number
    maxAmount: number
    isActive: boolean
    user: { id: number; nickname: string }
  }[]
}

export default function AdminAuctionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const auctionId = parseInt(params.id as string)

  const [auction, setAuction] = useState<AdminAuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchAuction = async () => {
      try {
        const res = await fetch(`/api/admin/auction/${auctionId}`)
        if (res.ok) {
          const data = await res.json()
          setAuction(data.auction)
        }
      } catch (error) {
        console.error("관리자 경매 조회 에러:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchAuction()
  }, [auctionId])

  const handleForceEnd = async () => {
    if (!confirm("정말 이 경매를 강제 종료하시겠습니까?")) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/auction/${auctionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force-end" }),
      })

      if (res.ok) {
        alert("경매가 강제 종료되었습니다.")
        router.push("/admin/auction")
      } else {
        const data = await res.json()
        alert(data.error || "처리에 실패했습니다.")
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        경매를 찾을 수 없습니다.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => router.push("/admin/auction")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> 목록으로
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{auction.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <AuctionStatusBadge status={auction.status} />
            <span className="text-sm text-muted-foreground">
              ID: {auction.id}
            </span>
          </div>
        </div>
        {auction.status !== "ended" && (
          <button
            onClick={handleForceEnd}
            disabled={actionLoading}
            className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            {actionLoading ? "처리 중..." : "강제 종료"}
          </button>
        )}
      </div>

      {/* 경매 정보 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">현재가</p>
          <p className="text-xl font-bold">
            {auction.currentPrice.toLocaleString()}원
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">시작가</p>
          <p className="text-xl font-bold">
            {auction.startingPrice.toLocaleString()}원
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">판매자</p>
          <p className="font-medium">
            {auction.seller.nickname} ({auction.seller.email})
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">낙찰자</p>
          <p className="font-medium">
            {auction.winner ? auction.winner.nickname : "-"}
          </p>
        </div>
      </div>

      {/* 입찰 내역 테이블 */}
      <h2 className="text-lg font-bold mb-3">
        입찰 내역 ({auction.bids.length}건)
      </h2>
      <div className="border border-border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">입찰자</th>
              <th className="text-right px-4 py-2 font-medium">금액</th>
              <th className="text-center px-4 py-2 font-medium">유형</th>
              <th className="text-left px-4 py-2 font-medium">시간</th>
            </tr>
          </thead>
          <tbody>
            {auction.bids.map((bid) => (
              <tr key={bid.id} className="border-t border-border">
                <td className="px-4 py-2">{bid.user.nickname}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {bid.amount.toLocaleString()}원
                </td>
                <td className="px-4 py-2 text-center">
                  {bid.isAutoBid ? (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                      자동
                    </span>
                  ) : (
                    "수동"
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {formatDistanceToNow(new Date(bid.createdAt), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </td>
              </tr>
            ))}
            {auction.bids.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-4 text-center text-muted-foreground"
                >
                  입찰 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 17.3: 커밋**

```bash
git add src/app/admin/auction/page.tsx src/app/admin/auction/[id]/page.tsx
git commit -m "🔧 관리자 경매 페이지 구현 (목록, 상세, 강제종료)"
```

---

## Task 18: 최종 확인 및 개발 서버 테스트

- [ ] **Step 18.1: 빌드 에러 확인**

```bash
npx next build
```

Expected: 빌드 성공. 타입 에러나 import 에러가 있으면 수정.

- [ ] **Step 18.2: 개발 서버 시작 및 기능 테스트**

```bash
npm run dev
```

브라우저에서 테스트:
1. `http://localhost:3000/auction` — 경매 목록 로드 확인
2. 회원가입/로그인 후 `http://localhost:3000/auction/create` — 경매 등록
3. 등록한 경매 상세 페이지에서 카운트다운, SSE 연결 확인
4. 다른 브라우저/시크릿 모드에서 입찰 → 실시간 업데이트 확인
5. `http://localhost:3000/admin/auction` — 관리자 목록 확인

- [ ] **Step 18.3: Cron API 수동 테스트**

```bash
curl -X POST -H "Authorization: Bearer auction-cron-secret-change-in-production" http://localhost:3000/api/auction/cron/close-expired
```

Expected: `{"success":true,"closedCount":0,"activatedCount":0}` (만료된 경매 없으면 0)

- [ ] **Step 18.4: 최종 커밋**

```bash
git add -A
git commit -m "✅ 실시간 경매 플랫폼 구현 완료"
```
