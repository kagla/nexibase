# Multi-Page Widget System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home-only widget system with a unified page builder — custom pages with URL routing, layout templates, 6 content widget types, a visual drag-and-drop editor with split-view settings panel, and SEO metadata.

**Architecture:** Two new Prisma models (`WidgetPage` + `PageWidget`) replace `HomeWidget`. Existing home widget data is migrated. Content widgets use a renderer registry parallel to the existing code-widget registry. A Next.js catch-all route serves custom pages. The admin UI moves from `/admin/home-widgets` to `/admin/pages` with a visual split-view editor using `@dnd-kit` for drag-and-drop.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma (MySQL), Tailwind v4, shadcn/ui, `@dnd-kit`, `next-intl`, TipTap (existing), Zod.

**Spec:** [`docs/superpowers/specs/2026-04-16-multi-page-widgets-design.md`](../specs/2026-04-16-multi-page-widgets-design.md)

**Branch:** `feat/multi-page-widgets`

**Test note:** No test runner in this repo. Verification is manual (dev server + browser) and build checks. Each task includes scan-plugins + tsc verification.

---

## File Structure

### New files

```
prisma/migrations/<timestamp>_add_widget_pages/migration.sql

src/lib/widgets/layout-templates.ts
src/lib/widgets/content-renderers/
├── index.ts
├── RichTextRenderer.tsx
├── ImageBannerRenderer.tsx
├── HtmlEmbedRenderer.tsx
├── ButtonCtaRenderer.tsx
├── SpacerRenderer.tsx
└── VideoEmbedRenderer.tsx

src/components/admin/widget-editors/
├── index.ts
├── RichTextEditor.tsx
├── ImageBannerEditor.tsx
├── HtmlEmbedEditor.tsx
├── ButtonCtaEditor.tsx
├── SpacerEditor.tsx
└── VideoEmbedEditor.tsx

src/app/[locale]/admin/pages/
├── page.tsx                          # Page list
└── [id]/
    └── page.tsx                      # Visual editor

src/app/api/admin/pages/
├── route.ts                          # GET list, POST create
└── [id]/
    ├── route.ts                      # GET, PUT, DELETE page
    ├── layout/route.ts               # PUT bulk widget layout
    └── widgets/
        ├── route.ts                  # POST add widget
        └── [widgetId]/route.ts       # DELETE remove widget

src/app/api/pages/[...slug]/route.ts  # Public: GET page widgets by slug
src/app/[locale]/[...slug]/page.tsx   # Public: render custom page
```

### Modified files

```
prisma/schema.base.prisma            # Replace HomeWidget with WidgetPage + PageWidget
src/lib/widgets/renderer.tsx          # Add content widget rendering
src/lib/widgets/registry.ts           # Re-export content renderers
src/lib/SiteContext.tsx               # Update widget fetching for backward compat
src/components/layout/UserLayout.tsx  # No changes needed (reads from SiteContext as before)
src/app/api/home-widgets/route.ts     # Rewrite to read from PageWidget
src/app/[locale]/page.tsx             # Rewrite to use WidgetPage(slug:"")
src/layouts/default/HomePage.tsx      # Simplify or remove (page rendering moves to catch-all pattern)
```

### Removed files

```
src/app/[locale]/admin/home-widgets/page.tsx    # Replaced by /admin/pages
src/app/api/admin/home-widgets/                 # Replaced by /api/admin/pages
```

---

## Task 1: Schema migration — WidgetPage + PageWidget

**Files:**
- Modify: `prisma/schema.base.prisma` (replace HomeWidget model)
- Create: `prisma/migrations/<timestamp>_add_widget_pages/migration.sql`

This task creates both new tables, migrates existing data, and drops the old table — all in a single migration.

- [ ] **Step 1: Update the Prisma schema**

Replace the `HomeWidget` model in `prisma/schema.base.prisma` (lines 133-148) with:

```prisma
model WidgetPage {
  id               Int          @id @default(autoincrement())
  title            String       @db.VarChar(200)
  slug             String       @unique @db.VarChar(200)
  layoutTemplate   String       @default("full-width") @db.VarChar(30)
  isActive         Boolean      @default(true)
  sortOrder        Int          @default(0)
  seoTitle         String?      @db.VarChar(200)
  seoDescription   String?      @db.VarChar(500)
  seoOgImage       String?      @db.VarChar(500)
  seoOgTitle       String?      @db.VarChar(200)
  seoOgDescription String?      @db.VarChar(500)
  seoCanonical     String?      @db.VarChar(500)
  seoNoIndex       Boolean      @default(false)
  seoNoFollow      Boolean      @default(false)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  widgets          PageWidget[]

  @@index([slug])
  @@index([isActive])
  @@map("widget_pages")
}

model PageWidget {
  id         Int         @id @default(autoincrement())
  pageId     Int
  widgetKey  String      @db.VarChar(50)
  widgetType String      @default("registry") @db.VarChar(20)
  zone       String      @db.VarChar(20)
  title      String      @db.VarChar(100)
  settings   String?     @db.Text
  colSpan    Int         @default(1)
  rowSpan    Int         @default(1)
  isActive   Boolean     @default(true)
  sortOrder  Int         @default(0)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  page       WidgetPage  @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId, zone, sortOrder])
  @@map("page_widgets")
}
```

- [ ] **Step 2: Regenerate merged schema**

```bash
node scripts/scan-plugins.js
```

Verify: `grep -n "WidgetPage\|PageWidget" prisma/schema.prisma`

- [ ] **Step 3: Write the migration SQL manually**

Create `prisma/migrations/20260416_010000_add_widget_pages/migration.sql`:

```sql
-- CreateTable: widget_pages
CREATE TABLE `widget_pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `layoutTemplate` VARCHAR(30) NOT NULL DEFAULT 'full-width',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `seoTitle` VARCHAR(200) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `seoOgImage` VARCHAR(500) NULL,
    `seoOgTitle` VARCHAR(200) NULL,
    `seoOgDescription` VARCHAR(500) NULL,
    `seoCanonical` VARCHAR(500) NULL,
    `seoNoIndex` BOOLEAN NOT NULL DEFAULT false,
    `seoNoFollow` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `widget_pages_slug_key`(`slug`),
    INDEX `widget_pages_slug_idx`(`slug`),
    INDEX `widget_pages_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: page_widgets
CREATE TABLE `page_widgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageId` INTEGER NOT NULL,
    `widgetKey` VARCHAR(50) NOT NULL,
    `widgetType` VARCHAR(20) NOT NULL DEFAULT 'registry',
    `zone` VARCHAR(20) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `settings` TEXT NULL,
    `colSpan` INTEGER NOT NULL DEFAULT 1,
    `rowSpan` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `page_widgets_pageId_zone_sortOrder_idx`(`pageId`, `zone`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `page_widgets` ADD CONSTRAINT `page_widgets_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `widget_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate data: create Home page and copy widgets
INSERT INTO `widget_pages` (`title`, `slug`, `layoutTemplate`, `isActive`, `sortOrder`, `updatedAt`)
VALUES ('Home', '', 'with-sidebar', true, 0, NOW());

INSERT INTO `page_widgets` (`pageId`, `widgetKey`, `widgetType`, `zone`, `title`, `settings`, `colSpan`, `rowSpan`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT
    (SELECT `id` FROM `widget_pages` WHERE `slug` = ''),
    `widgetKey`, 'registry', `zone`, `title`, `settings`, `colSpan`, `rowSpan`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`
FROM `home_widgets`;

-- Drop old table
DROP TABLE `home_widgets`;
```

- [ ] **Step 4: Apply the migration**

```bash
npx prisma db push --skip-generate
npx prisma generate
```

If `prisma db push` fails due to the migration approach, apply the SQL directly:

```bash
npx prisma db execute --file prisma/migrations/20260416_010000_add_widget_pages/migration.sql
npx prisma generate
```

- [ ] **Step 5: Verify Prisma client has the new models**

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.widgetPage.findMany, typeof p.pageWidget.findMany)"
```

Expected: `function function`

Also verify the migration preserved data:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pages = await p.widgetPage.findMany({ include: { widgets: true } });
  console.log('pages:', pages.length);
  pages.forEach(pg => console.log(pg.title, pg.slug, 'widgets:', pg.widgets.length));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
"
```

Expected: `pages: 1` with `Home` page and the same number of widgets as the old `home_widgets` table had.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.base.prisma prisma/migrations/
git commit -m "feat(pages): add WidgetPage + PageWidget models, migrate from HomeWidget"
```

---

## Task 2: Layout templates constant

**Files:**
- Create: `src/lib/widgets/layout-templates.ts`

- [ ] **Step 1: Create the layout templates file**

```ts
export type LayoutTemplateId = 'full-width' | 'with-sidebar' | 'minimal'

export interface LayoutTemplate {
  label: string
  zones: readonly string[]
}

export const LAYOUT_TEMPLATES: Record<LayoutTemplateId, LayoutTemplate> = {
  'full-width': {
    label: 'Full Width',
    zones: ['top', 'main', 'bottom'],
  },
  'with-sidebar': {
    label: 'With Sidebar',
    zones: ['top', 'left', 'center', 'right', 'bottom'],
  },
  'minimal': {
    label: 'Minimal',
    zones: ['main'],
  },
} as const

export const LAYOUT_TEMPLATE_IDS = Object.keys(LAYOUT_TEMPLATES) as LayoutTemplateId[]

export function getTemplateZones(templateId: string): readonly string[] {
  return LAYOUT_TEMPLATES[templateId as LayoutTemplateId]?.zones ?? LAYOUT_TEMPLATES['full-width'].zones
}

export function isValidTemplate(templateId: string): templateId is LayoutTemplateId {
  return templateId in LAYOUT_TEMPLATES
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "layout-templates" || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/widgets/layout-templates.ts
git commit -m "feat(pages): add layout template constants (full-width, with-sidebar, minimal)"
```

---

## Task 3: Content widget renderers (6 types)

**Files:**
- Create: `src/lib/widgets/content-renderers/index.ts`
- Create: `src/lib/widgets/content-renderers/RichTextRenderer.tsx`
- Create: `src/lib/widgets/content-renderers/ImageBannerRenderer.tsx`
- Create: `src/lib/widgets/content-renderers/HtmlEmbedRenderer.tsx`
- Create: `src/lib/widgets/content-renderers/ButtonCtaRenderer.tsx`
- Create: `src/lib/widgets/content-renderers/SpacerRenderer.tsx`
- Create: `src/lib/widgets/content-renderers/VideoEmbedRenderer.tsx`

- [ ] **Step 1: Create the registry index**

Create `src/lib/widgets/content-renderers/index.ts`:

```ts
import { ComponentType } from 'react'
import RichTextRenderer from './RichTextRenderer'
import ImageBannerRenderer from './ImageBannerRenderer'
import HtmlEmbedRenderer from './HtmlEmbedRenderer'
import ButtonCtaRenderer from './ButtonCtaRenderer'
import SpacerRenderer from './SpacerRenderer'
import VideoEmbedRenderer from './VideoEmbedRenderer'

export const contentRenderers: Record<string, ComponentType<{ settings?: Record<string, unknown> }>> = {
  'rich-text': RichTextRenderer,
  'image-banner': ImageBannerRenderer,
  'html-embed': HtmlEmbedRenderer,
  'button-cta': ButtonCtaRenderer,
  'spacer': SpacerRenderer,
  'video-embed': VideoEmbedRenderer,
}

export const CONTENT_WIDGET_TYPES = [
  { key: 'rich-text', label: 'Rich Text', description: 'Formatted text with images and links' },
  { key: 'image-banner', label: 'Image Banner', description: 'Full-width image with optional link' },
  { key: 'html-embed', label: 'HTML Embed', description: 'Custom HTML or embed code' },
  { key: 'button-cta', label: 'Button / CTA', description: 'Call-to-action button with link' },
  { key: 'spacer', label: 'Spacer', description: 'Empty space between widgets' },
  { key: 'video-embed', label: 'Video', description: 'YouTube or Vimeo embed' },
] as const
```

- [ ] **Step 2: Create RichTextRenderer**

Create `src/lib/widgets/content-renderers/RichTextRenderer.tsx`:

```tsx
'use client'

export default function RichTextRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const html = (settings?.html as string) ?? ''
  if (!html) return null

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

- [ ] **Step 3: Create ImageBannerRenderer**

Create `src/lib/widgets/content-renderers/ImageBannerRenderer.tsx`:

```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function ImageBannerRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const src = (settings?.src as string) ?? ''
  const alt = (settings?.alt as string) ?? ''
  const href = (settings?.href as string) ?? ''
  const height = (settings?.height as number) ?? 300

  if (!src) return null

  const img = (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ height }}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="100vw" />
    </div>
  )

  if (href) {
    return <Link href={href}>{img}</Link>
  }
  return img
}
```

- [ ] **Step 4: Create HtmlEmbedRenderer**

Create `src/lib/widgets/content-renderers/HtmlEmbedRenderer.tsx`:

```tsx
'use client'

export default function HtmlEmbedRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const code = (settings?.code as string) ?? ''
  if (!code) return null

  return <div dangerouslySetInnerHTML={{ __html: code }} />
}
```

- [ ] **Step 5: Create ButtonCtaRenderer**

Create `src/lib/widgets/content-renderers/ButtonCtaRenderer.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Variant = 'default' | 'outline' | 'destructive'
type Size = 'sm' | 'default' | 'lg'
type Align = 'left' | 'center' | 'right'

const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export default function ButtonCtaRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const text = (settings?.text as string) ?? 'Click here'
  const href = (settings?.href as string) ?? '#'
  const variant = (settings?.variant as Variant) ?? 'default'
  const size = (settings?.size as Size) ?? 'default'
  const align = (settings?.align as Align) ?? 'center'

  return (
    <div className={ALIGN_CLASS[align]}>
      <Button asChild variant={variant} size={size}>
        <Link href={href}>{text}</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: Create SpacerRenderer**

Create `src/lib/widgets/content-renderers/SpacerRenderer.tsx`:

```tsx
'use client'

export default function SpacerRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const height = (settings?.height as number) ?? 40
  return <div style={{ height }} aria-hidden />
}
```

- [ ] **Step 7: Create VideoEmbedRenderer**

Create `src/lib/widgets/content-renderers/VideoEmbedRenderer.tsx`:

```tsx
'use client'

function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo' | null; id: string } {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }
  // Vimeo
  const vmMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vmMatch) return { provider: 'vimeo', id: vmMatch[1] }
  return { provider: null, id: '' }
}

const ASPECT_RATIO: Record<string, string> = {
  '16:9': '56.25%',
  '4:3': '75%',
}

export default function VideoEmbedRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const url = (settings?.url as string) ?? ''
  const aspectRatio = (settings?.aspectRatio as string) ?? '16:9'

  const { provider, id } = parseVideoUrl(url)
  if (!provider || !id) return null

  const embedUrl = provider === 'youtube'
    ? `https://www.youtube.com/embed/${id}`
    : `https://player.vimeo.com/video/${id}`

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: ASPECT_RATIO[aspectRatio] ?? '56.25%' }}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
```

- [ ] **Step 8: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "content-renderers" || echo "no errors"
git add src/lib/widgets/content-renderers/
git commit -m "feat(pages): add 6 content widget renderers"
```

---

## Task 4: Extend WidgetRenderer for content widgets

**Files:**
- Modify: `src/lib/widgets/renderer.tsx`

- [ ] **Step 1: Update renderer to handle widgetType "content"**

Replace the full content of `src/lib/widgets/renderer.tsx`:

```tsx
"use client"

import { widgetRegistry } from './registry'
import { contentRenderers } from './content-renderers'

interface WidgetData {
  id: number
  widgetKey: string
  widgetType?: string
  zone: string
  title: string
  settings: string | null
  colSpan: number
  rowSpan: number
  isActive: boolean
  sortOrder: number
}

interface WidgetRendererProps {
  zone: string
  widgets: WidgetData[]
}

export default function WidgetRenderer({ zone, widgets }: WidgetRendererProps) {
  const zoneWidgets = widgets
    .filter(w => w.zone === zone && w.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (zoneWidgets.length === 0) return null

  const isSidebar = zone === 'left' || zone === 'right' || zone === 'sidebar'
  const allFullWidth = isSidebar || zoneWidgets.every(w => w.colSpan >= 12)

  if (allFullWidth) {
    return (
      <div className="space-y-4">
        {zoneWidgets.map((widget) => (
          <div key={widget.id}>{renderWidgetContent(widget)}</div>
        ))}
      </div>
    )
  }

  const MD_SPAN_CLASS: Record<number, string> = {
    1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3',
    4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6',
    7: 'md:col-span-7', 8: 'md:col-span-8', 9: 'md:col-span-9',
    10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {zoneWidgets.map((widget) => {
        const span = Math.min(Math.max(widget.colSpan || 12, 1), 12)
        return (
          <div key={widget.id} className={`col-span-12 ${MD_SPAN_CLASS[span]}`}>
            {renderWidgetContent(widget)}
          </div>
        )
      })}
    </div>
  )
}

function renderWidgetContent(widget: WidgetData) {
  let settings: Record<string, unknown> = {}
  try {
    settings = widget.settings ? JSON.parse(widget.settings) : {}
  } catch {
    settings = {}
  }

  // Content widgets
  if (widget.widgetType === 'content') {
    const Renderer = contentRenderers[widget.widgetKey]
    if (!Renderer) {
      console.warn(`unknown content widget type: ${widget.widgetKey}`)
      return null
    }
    return <Renderer settings={settings} />
  }

  // Registry widgets (default)
  const definition = widgetRegistry[widget.widgetKey]
  if (!definition) {
    console.warn(`widget key not in the registry: ${widget.widgetKey}`)
    return null
  }

  const Component = definition.component
  return <Component settings={settings} />
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "renderer" || echo "no errors"
git add src/lib/widgets/renderer.tsx
git commit -m "feat(pages): extend WidgetRenderer to handle content widget types"
```

---

## Task 5: Admin API — Page CRUD

**Files:**
- Create: `src/app/api/admin/pages/route.ts`
- Create: `src/app/api/admin/pages/[id]/route.ts`

- [ ] **Step 1: Create page list + create route**

Create `src/app/api/admin/pages/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { isValidTemplate } from '@/lib/widgets/layout-templates'
import { pluginManifest } from '@/plugins/_generated'

const SYSTEM_SLUGS = ['admin', 'login', 'signup', 'mypage', 'api', 'install', 'setup-required', 'verify-email', 'profile', 'search', 'new']
const PLUGIN_SLUGS = Object.values(pluginManifest).map(p => p.slug)
const RESERVED_SLUGS = [...SYSTEM_SLUGS, ...PLUGIN_SLUGS]

function isSlugReserved(slug: string): boolean {
  const firstSegment = slug.split('/')[0]
  return RESERVED_SLUGS.includes(firstSegment)
}

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const pages = await prisma.widgetPage.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { widgets: true } } },
    })
    return NextResponse.json({ pages })
  } catch (err) {
    console.error('[pages] failed to list pages:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { title, slug, layoutTemplate } = body as { title?: string; slug?: string; layoutTemplate?: string }

    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const normalizedSlug = (slug ?? '').trim().replace(/^\/+|\/+$/g, '').toLowerCase()

    if (normalizedSlug && isSlugReserved(normalizedSlug)) {
      return NextResponse.json({ error: `Slug "${normalizedSlug}" is reserved` }, { status: 400 })
    }

    const existing = await prisma.widgetPage.findUnique({ where: { slug: normalizedSlug } })
    if (existing) {
      return NextResponse.json({ error: `Slug "${normalizedSlug}" is already in use` }, { status: 400 })
    }

    const template = layoutTemplate && isValidTemplate(layoutTemplate) ? layoutTemplate : 'full-width'

    const page = await prisma.widgetPage.create({
      data: { title: title.trim(), slug: normalizedSlug, layoutTemplate: template },
    })

    return NextResponse.json({ page }, { status: 201 })
  } catch (err) {
    console.error('[pages] failed to create page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create page detail / update / delete route**

Create `src/app/api/admin/pages/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { isValidTemplate } from '@/lib/widgets/layout-templates'
import { pluginManifest } from '@/plugins/_generated'

const SYSTEM_SLUGS = ['admin', 'login', 'signup', 'mypage', 'api', 'install', 'setup-required', 'verify-email', 'profile', 'search', 'new']
const PLUGIN_SLUGS = Object.values(pluginManifest).map(p => p.slug)
const RESERVED_SLUGS = [...SYSTEM_SLUGS, ...PLUGIN_SLUGS]

function isSlugReserved(slug: string): boolean {
  const firstSegment = slug.split('/')[0]
  return RESERVED_SLUGS.includes(firstSegment)
}

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const id = parseId(raw)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const page = await prisma.widgetPage.findUnique({
      where: { id },
      include: {
        widgets: { orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }] },
      },
    })
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    console.error('[pages] failed to get page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const id = parseId(raw)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}

    if (body.title !== undefined) data.title = body.title.trim()
    if (body.slug !== undefined) {
      const normalizedSlug = body.slug.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
      if (normalizedSlug && isSlugReserved(normalizedSlug)) {
        return NextResponse.json({ error: `Slug "${normalizedSlug}" is reserved` }, { status: 400 })
      }
      const existing = await prisma.widgetPage.findUnique({ where: { slug: normalizedSlug } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: `Slug "${normalizedSlug}" is already in use` }, { status: 400 })
      }
      data.slug = normalizedSlug
    }
    if (body.layoutTemplate !== undefined && isValidTemplate(body.layoutTemplate)) {
      data.layoutTemplate = body.layoutTemplate
    }
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

    // SEO fields
    const seoFields = ['seoTitle', 'seoDescription', 'seoOgImage', 'seoOgTitle', 'seoOgDescription', 'seoCanonical']
    for (const field of seoFields) {
      if (body[field] !== undefined) data[field] = body[field] || null
    }
    if (body.seoNoIndex !== undefined) data.seoNoIndex = body.seoNoIndex
    if (body.seoNoFollow !== undefined) data.seoNoFollow = body.seoNoFollow

    const page = await prisma.widgetPage.update({ where: { id }, data })
    return NextResponse.json({ page })
  } catch (err) {
    console.error('[pages] failed to update page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const id = parseId(raw)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const page = await prisma.widgetPage.findUnique({ where: { id } })
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (page.slug === '') {
      return NextResponse.json({ error: 'Cannot delete the Home page' }, { status: 400 })
    }
    await prisma.widgetPage.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pages] failed to delete page:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "api/admin/pages" || echo "no errors"
git add src/app/api/admin/pages/
git commit -m "feat(pages): admin API for page CRUD (list/create/get/update/delete)"
```

---

## Task 6: Admin API — Widget layout management

**Files:**
- Create: `src/app/api/admin/pages/[id]/layout/route.ts`
- Create: `src/app/api/admin/pages/[id]/widgets/route.ts`
- Create: `src/app/api/admin/pages/[id]/widgets/[widgetId]/route.ts`

- [ ] **Step 1: Create bulk layout save route**

Create `src/app/api/admin/pages/[id]/layout/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

interface WidgetUpdate {
  id: number
  zone: string
  sortOrder: number
  colSpan?: number
  rowSpan?: number
  isActive?: boolean
  title?: string
  settings?: string | null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const pageId = parseId(raw)
  if (!pageId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()
    const { items } = body as { items: WidgetUpdate[] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.pageWidget.update({
          where: { id: item.id },
          data: {
            zone: item.zone,
            sortOrder: item.sortOrder,
            ...(item.colSpan !== undefined && { colSpan: item.colSpan }),
            ...(item.rowSpan !== undefined && { rowSpan: item.rowSpan }),
            ...(item.isActive !== undefined && { isActive: item.isActive }),
            ...(item.title !== undefined && { title: item.title }),
            ...(item.settings !== undefined && { settings: item.settings }),
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pages] failed to save layout:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create add-widget route**

Create `src/app/api/admin/pages/[id]/widgets/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: raw } = await params
  const pageId = parseId(raw)
  if (!pageId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await request.json()
    const { widgetKey, widgetType, zone, title, settings } = body as {
      widgetKey: string
      widgetType?: string
      zone: string
      title: string
      settings?: string | null
    }

    if (!widgetKey || !zone || !title) {
      return NextResponse.json({ error: 'widgetKey, zone, and title are required' }, { status: 400 })
    }

    const widget = await prisma.pageWidget.create({
      data: {
        pageId,
        widgetKey,
        widgetType: widgetType === 'content' ? 'content' : 'registry',
        zone,
        title,
        settings: settings ?? null,
        sortOrder: 99,
      },
    })

    return NextResponse.json({ widget }, { status: 201 })
  } catch (err) {
    console.error('[pages] failed to add widget:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create remove-widget route**

Create `src/app/api/admin/pages/[id]/widgets/[widgetId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

function parseId(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; widgetId: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { widgetId: rawWidgetId } = await params
  const widgetId = parseId(rawWidgetId)
  if (!widgetId) return NextResponse.json({ error: 'Invalid widgetId' }, { status: 400 })

  try {
    await prisma.pageWidget.delete({ where: { id: widgetId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pages] failed to remove widget:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "admin/pages" || echo "no errors"
git add src/app/api/admin/pages/
git commit -m "feat(pages): admin API for widget layout (bulk save, add, remove)"
```

---

## Task 7: Backward compatibility — Update public API + SiteContext

**Files:**
- Modify: `src/app/api/home-widgets/route.ts`
- Modify: `src/lib/SiteContext.tsx`
- Create: `src/app/api/pages/[...slug]/route.ts`

- [ ] **Step 1: Rewrite the public home-widgets API to read from PageWidget**

Replace `src/app/api/home-widgets/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'
import { isPluginEnabled } from '@/lib/plugins'

// GET /api/home-widgets — backward-compatible: returns Home page widgets grouped by zone
export async function GET() {
  try {
    const homePage = await prisma.widgetPage.findUnique({
      where: { slug: '' },
      include: {
        widgets: {
          where: { isActive: true },
          orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    })

    if (!homePage) {
      return NextResponse.json({ widgets: {} })
    }

    // Build set of disabled plugin folders
    const disabledFolders = new Set<string>()
    for (const [folder] of Object.entries(pluginManifest)) {
      const enabled = await isPluginEnabled(folder)
      if (!enabled) disabledFolders.add(folder)
    }

    // Filter out widgets belonging to disabled plugins (registry widgets only)
    const widgets = homePage.widgets.filter(widget => {
      if (widget.widgetType === 'content') return true
      return !Array.from(disabledFolders).some(folder =>
        widget.widgetKey.startsWith(`${folder}-`)
      )
    })

    // Group by zone
    const grouped: Record<string, typeof widgets> = {}
    for (const widget of widgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push(widget)
    }

    return NextResponse.json({ widgets: grouped })
  } catch (error) {
    console.error('failed to fetch widgets:', error)
    return NextResponse.json({ widgets: {} })
  }
}
```

- [ ] **Step 2: Create the public page widgets API**

Create `src/app/api/pages/[...slug]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug: segments } = await params
  const slug = segments.join('/')

  try {
    const page = await prisma.widgetPage.findUnique({
      where: { slug },
      include: {
        widgets: {
          where: { isActive: true },
          orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    })

    if (!page || !page.isActive) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Group by zone
    const grouped: Record<string, typeof page.widgets> = {}
    for (const widget of page.widgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push(widget)
    }

    return NextResponse.json({
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        layoutTemplate: page.layoutTemplate,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        seoOgImage: page.seoOgImage,
        seoOgTitle: page.seoOgTitle,
        seoOgDescription: page.seoOgDescription,
        seoCanonical: page.seoCanonical,
        seoNoIndex: page.seoNoIndex,
        seoNoFollow: page.seoNoFollow,
      },
      widgets: grouped,
    })
  } catch (error) {
    console.error('failed to fetch page widgets:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Update SiteContext to add widgetType to WidgetData**

In `src/lib/SiteContext.tsx`, find the `WidgetData` interface and add `widgetType`:

```ts
// Add widgetType to the WidgetData interface
interface WidgetData {
  id: number
  widgetKey: string
  widgetType?: string  // ADD THIS LINE
  zone: string
  title: string
  settings: string | null
  colSpan: number
  rowSpan: number
  isActive: boolean
  sortOrder: number
}
```

The rest of SiteContext (fetching `/api/home-widgets`, filtering sidebar widgets) works as before since the API response format is unchanged.

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "home-widgets|SiteContext|pages/\[" || echo "no errors"
git add src/app/api/home-widgets/route.ts src/app/api/pages/ src/lib/SiteContext.tsx
git commit -m "feat(pages): backward-compatible public API + page widgets endpoint"
```

---

## Task 8: Public catch-all route for custom pages

**Files:**
- Create: `src/app/[locale]/[...slug]/page.tsx`
- Modify: `src/app/[locale]/page.tsx` (home page)

- [ ] **Step 1: Create the catch-all page route**

Create `src/app/[locale]/[...slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { UserLayout } from '@/components/layout/UserLayout'
import WidgetRenderer from '@/lib/widgets/renderer'
import { getTemplateZones } from '@/lib/widgets/layout-templates'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string; slug: string[] }>
}

async function getWidgetPage(slug: string) {
  return prisma.widgetPage.findUnique({
    where: { slug },
    include: {
      widgets: {
        where: { isActive: true },
        orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: segments } = await params
  const slug = segments.join('/')
  const page = await getWidgetPage(slug)

  if (!page || !page.isActive) return {}

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    openGraph: {
      title: page.seoOgTitle || page.seoTitle || page.title,
      description: page.seoOgDescription || page.seoDescription || undefined,
      images: page.seoOgImage ? [page.seoOgImage] : undefined,
    },
    robots: {
      index: !page.seoNoIndex,
      follow: !page.seoNoFollow,
    },
    alternates: page.seoCanonical ? { canonical: page.seoCanonical } : undefined,
  }
}

export default async function CustomPage({ params }: PageProps) {
  const { slug: segments } = await params
  const slug = segments.join('/')
  const page = await getWidgetPage(slug)

  if (!page || !page.isActive) notFound()

  const zones = getTemplateZones(page.layoutTemplate)
  const allWidgets = page.widgets

  // Full-width: top / main / bottom (no sidebar)
  if (page.layoutTemplate === 'full-width') {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <div className="space-y-6">
          {zones.map(zone => (
            <WidgetRenderer key={zone} zone={zone} widgets={allWidgets} />
          ))}
        </div>
      </div>
    )
  }

  // Minimal: single main zone, narrower max-width
  if (page.layoutTemplate === 'minimal') {
    return (
      <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <WidgetRenderer zone="main" widgets={allWidgets} />
      </div>
    )
  }

  // With-sidebar: uses UserLayout which reads sidebar widgets from SiteContext
  // But this page has its own sidebar widgets — render them directly
  const leftWidgets = allWidgets.filter(w => w.zone === 'left')
  const rightWidgets = allWidgets.filter(w => w.zone === 'right')
  const hasLeft = leftWidgets.length > 0
  const hasRight = rightWidgets.length > 0
  const leftCols = hasLeft ? 3 : 0
  const rightCols = hasRight ? 3 : 0
  const centerCols = 12 - leftCols - rightCols

  const colSpanClass: Record<number, string> = {
    3: 'md:col-span-3', 6: 'md:col-span-6', 9: 'md:col-span-9', 12: 'md:col-span-12',
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
      <WidgetRenderer zone="top" widgets={allWidgets} />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {hasLeft && (
          <aside className={colSpanClass[leftCols]}>
            <WidgetRenderer zone="left" widgets={allWidgets} />
          </aside>
        )}
        <main className={colSpanClass[centerCols]}>
          <WidgetRenderer zone="center" widgets={allWidgets} />
        </main>
        {hasRight && (
          <aside className={colSpanClass[rightCols]}>
            <WidgetRenderer zone="right" widgets={allWidgets} />
          </aside>
        )}
      </div>
      <div className="mt-6">
        <WidgetRenderer zone="bottom" widgets={allWidgets} />
      </div>
    </div>
  )
}
```

**Important note:** This catch-all route will match any slug not already handled by a more specific route. Existing plugin routes (`/boards`, `/shop`, etc.) and system routes (`/admin`, `/login`, etc.) are more specific and take precedence in Next.js routing. The catch-all only triggers when no other route matches.

- [ ] **Step 2: Update home page to use WidgetPage**

Replace `src/app/[locale]/page.tsx`:

```tsx
import { prisma } from '@/lib/prisma'
import { UserLayout } from '@/components/layout/UserLayout'
import WidgetRenderer from '@/lib/widgets/renderer'
import type { Metadata } from 'next'

async function getHomePage() {
  return prisma.widgetPage.findUnique({
    where: { slug: '' },
    include: {
      widgets: {
        where: { isActive: true },
        orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  })
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getHomePage()
  if (!page) return {}

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
  }
}

export default async function HomePage() {
  const page = await getHomePage()
  const allWidgets = page?.widgets ?? []

  return (
    <UserLayout>
      <div className="space-y-6">
        <WidgetRenderer zone="top" widgets={allWidgets} />
        <WidgetRenderer zone="center" widgets={allWidgets} />
        <WidgetRenderer zone="bottom" widgets={allWidgets} />
      </div>
    </UserLayout>
  )
}
```

This converts the home page from a client component (fetching via API) to a server component (direct Prisma query). Sidebar widgets continue to work via `UserLayout` + `SiteContext`.

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "\[\.\.\.slug\]|page\.tsx" || echo "no errors"
git add 'src/app/[locale]/[...slug]/page.tsx' 'src/app/[locale]/page.tsx'
git commit -m "feat(pages): public catch-all route for custom pages + server-component home page"
```

---

## Task 9: Content widget admin editors (6 types)

**Files:**
- Create: `src/components/admin/widget-editors/index.ts`
- Create: `src/components/admin/widget-editors/RichTextEditor.tsx`
- Create: `src/components/admin/widget-editors/ImageBannerEditor.tsx`
- Create: `src/components/admin/widget-editors/HtmlEmbedEditor.tsx`
- Create: `src/components/admin/widget-editors/ButtonCtaEditor.tsx`
- Create: `src/components/admin/widget-editors/SpacerEditor.tsx`
- Create: `src/components/admin/widget-editors/VideoEmbedEditor.tsx`

Each editor receives `{ settings, onChange }` and calls `onChange` on every change. The parent manages save timing (bulk save on "Save Layout").

- [ ] **Step 1: Create editor registry**

Create `src/components/admin/widget-editors/index.ts`:

```ts
import { ComponentType } from 'react'
import RichTextEditor from './RichTextEditor'
import ImageBannerEditor from './ImageBannerEditor'
import HtmlEmbedEditor from './HtmlEmbedEditor'
import ButtonCtaEditor from './ButtonCtaEditor'
import SpacerEditor from './SpacerEditor'
import VideoEmbedEditor from './VideoEmbedEditor'

export interface WidgetEditorProps {
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
}

export const contentEditors: Record<string, ComponentType<WidgetEditorProps>> = {
  'rich-text': RichTextEditor,
  'image-banner': ImageBannerEditor,
  'html-embed': HtmlEmbedEditor,
  'button-cta': ButtonCtaEditor,
  'spacer': SpacerEditor,
  'video-embed': VideoEmbedEditor,
}
```

- [ ] **Step 2: Create RichTextEditor**

Create `src/components/admin/widget-editors/RichTextEditor.tsx`:

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import type { WidgetEditorProps } from './index'

export default function RichTextEditor({ settings, onChange }: WidgetEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      Underline,
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content: (settings.html as string) ?? '',
    onUpdate: ({ editor: e }) => {
      onChange({ ...settings, html: e.getHTML() })
    },
  })

  if (!editor) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border-b pb-2">
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('bold') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('italic') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('underline') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={`px-2 py-1 text-xs rounded ${editor.isActive('bulletList') ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => editor.chain().focus().toggleBulletList().run()}>List</button>
        <button type="button" className="px-2 py-1 text-xs rounded bg-muted" onClick={() => {
          const url = window.prompt('Link URL')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}>Link</button>
        <button type="button" className="px-2 py-1 text-xs rounded bg-muted" onClick={async () => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch('/api/tiptap-image-upload', { method: 'POST', body: formData })
            if (res.ok) {
              const data = await res.json()
              editor.chain().focus().setImage({ src: data.url }).run()
            }
          }
          input.click()
        }}>Image</button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-[120px] border rounded p-2" />
    </div>
  )
}
```

- [ ] **Step 3: Create ImageBannerEditor**

Create `src/components/admin/widget-editors/ImageBannerEditor.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { WidgetEditorProps } from './index'

export default function ImageBannerEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  async function handleUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/tiptap-image-upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        update('src', data.url)
      }
    }
    input.click()
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Image</Label>
        {settings.src ? (
          <div className="mt-1 space-y-2">
            <img src={settings.src as string} alt="" className="max-h-32 rounded border object-cover" />
            <Button variant="outline" size="sm" onClick={handleUpload}>Change image</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-1" onClick={handleUpload}>Upload image</Button>
        )}
      </div>
      <div>
        <Label>Alt text</Label>
        <Input value={(settings.alt as string) ?? ''} onChange={e => update('alt', e.target.value)} />
      </div>
      <div>
        <Label>Link URL (optional)</Label>
        <Input value={(settings.href as string) ?? ''} onChange={e => update('href', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <Label>Height (px)</Label>
        <Input type="number" value={(settings.height as number) ?? 300} onChange={e => update('height', parseInt(e.target.value) || 300)} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create HtmlEmbedEditor**

Create `src/components/admin/widget-editors/HtmlEmbedEditor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { WidgetEditorProps } from './index'

export default function HtmlEmbedEditor({ settings, onChange }: WidgetEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const code = (settings.code as string) ?? ''

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <Label>HTML Code</Label>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
        {showPreview ? (
          <div className="mt-1 border rounded p-3 min-h-[120px]" dangerouslySetInnerHTML={{ __html: code }} />
        ) : (
          <textarea
            className="mt-1 w-full min-h-[120px] border rounded p-2 font-mono text-sm bg-muted/30"
            value={code}
            onChange={e => onChange({ ...settings, code: e.target.value })}
            placeholder="<div>Your HTML here...</div>"
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create ButtonCtaEditor**

Create `src/components/admin/widget-editors/ButtonCtaEditor.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { WidgetEditorProps } from './index'

export default function ButtonCtaEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-3">
      <div>
        <Label>Button text</Label>
        <Input value={(settings.text as string) ?? ''} onChange={e => update('text', e.target.value)} placeholder="Click here" />
      </div>
      <div>
        <Label>Link URL</Label>
        <Input value={(settings.href as string) ?? ''} onChange={e => update('href', e.target.value)} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Variant</Label>
          <Select value={(settings.variant as string) ?? 'default'} onValueChange={v => update('variant', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="destructive">Destructive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Size</Label>
          <Select value={(settings.size as string) ?? 'default'} onValueChange={v => update('size', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Align</Label>
          <Select value={(settings.align as string) ?? 'center'} onValueChange={v => update('align', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create SpacerEditor**

Create `src/components/admin/widget-editors/SpacerEditor.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WidgetEditorProps } from './index'

export default function SpacerEditor({ settings, onChange }: WidgetEditorProps) {
  return (
    <div>
      <Label>Height (px)</Label>
      <Input
        type="number"
        min={0}
        max={500}
        value={(settings.height as number) ?? 40}
        onChange={e => onChange({ ...settings, height: parseInt(e.target.value) || 40 })}
      />
    </div>
  )
}
```

- [ ] **Step 7: Create VideoEmbedEditor**

Create `src/components/admin/widget-editors/VideoEmbedEditor.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { WidgetEditorProps } from './index'

export default function VideoEmbedEditor({ settings, onChange }: WidgetEditorProps) {
  const update = (key: string, value: unknown) => onChange({ ...settings, [key]: value })

  return (
    <div className="space-y-3">
      <div>
        <Label>Video URL</Label>
        <Input
          value={(settings.url as string) ?? ''}
          onChange={e => update('url', e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <p className="mt-1 text-xs text-muted-foreground">Supports YouTube and Vimeo URLs</p>
      </div>
      <div>
        <Label>Aspect Ratio</Label>
        <Select value={(settings.aspectRatio as string) ?? '16:9'} onValueChange={v => update('aspectRatio', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
            <SelectItem value="4:3">4:3 (Standard)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "widget-editors" || echo "no errors"
git add src/components/admin/widget-editors/
git commit -m "feat(pages): add 6 content widget admin editors"
```

---

## Task 10: Admin page list UI

**Files:**
- Create: `src/app/[locale]/admin/pages/page.tsx`

This is a client component following the existing admin pattern: `"use client"`, `<Sidebar>`, `useTranslations`, fetch via admin API. Since locale keys for the new pages admin don't exist yet in en.json/ko.json, we use plain English strings for now (same approach as the fitness plugin).

- [ ] **Step 1: Create the page list admin page**

Create `src/app/[locale]/admin/pages/page.tsx` — this is a large file (~280 lines). The implementer should create it following the pattern established by `/admin/home-widgets/page.tsx` but adapted for page management:

- Fetch `GET /api/admin/pages` on mount
- Table with columns: Title (🏠 for Home), URL, Template, Widgets, Active toggle, Actions (Edit, Delete)
- "+ New Page" button → modal with title, slug, template select
- Delete with confirmation (Home page undeletable)
- Edit → `router.push('/admin/pages/${id}')`

The full code for this file should be produced by the implementer, following the existing admin pages pattern (shop orders, boards list). The key interfaces and API calls:

```ts
// Fetch
const res = await fetch('/api/admin/pages')
const { pages } = await res.json()

// Create
const res = await fetch('/api/admin/pages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, slug, layoutTemplate }),
})

// Delete
await fetch(`/api/admin/pages/${id}`, { method: 'DELETE' })

// Toggle active
await fetch(`/api/admin/pages/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isActive: !page.isActive }),
})
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "admin/pages" || echo "no errors"
git add 'src/app/[locale]/admin/pages/page.tsx'
git commit -m "feat(pages): admin page list with CRUD"
```

---

## Task 11: Admin visual editor (Split View + drag-and-drop)

**Files:**
- Create: `src/app/[locale]/admin/pages/[id]/page.tsx`

This is the largest and most complex file in the project (~500 lines). It implements the split-view visual editor with:

**Left panel (preview):**
- Zones rendered according to the page's layout template
- Widget cards inside each zone, draggable via `@dnd-kit`
- Drop zones for each template zone
- "Add Registry Widget" and "Add Content Widget" buttons

**Right panel (settings):**
- Widget title, zone select, colSpan/rowSpan inputs
- For registry widgets: dynamic settings form from `settingsSchema` (existing pattern from home-widgets)
- For content widgets: type-specific editor from `contentEditors` registry
- isActive toggle, Remove, Duplicate buttons

**Top toolbar:**
- Back link, page title + slug + template badge
- "Preview ↗" (opens public page in new tab)
- "Settings" gear icon → page settings modal (Task 12)
- "Save Layout" button

Key dependencies:
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (all already installed)
- `contentEditors` from `src/components/admin/widget-editors`
- `widgetMetadata` from `src/lib/widgets/_generated-metadata.ts`
- `LAYOUT_TEMPLATES`, `getTemplateZones` from `src/lib/widgets/layout-templates`
- `CONTENT_WIDGET_TYPES` from `src/lib/widgets/content-renderers`

API calls:
```ts
// Load page + widgets
GET /api/admin/pages/${id}

// Save layout (all widgets at once)
PUT /api/admin/pages/${id}/layout  body: { items: [...] }

// Add widget
POST /api/admin/pages/${id}/widgets  body: { widgetKey, widgetType, zone, title }

// Remove widget
DELETE /api/admin/pages/${id}/widgets/${widgetId}

// Save individual widget settings (via layout bulk save)
// Settings are saved as part of the bulk layout PUT
```

The implementer should create this following the spec's section 5 (Visual Preview Editor) and the existing admin patterns. The full component will be ~500 lines.

- [ ] **Step 1: Create the visual editor page**

The implementer creates `src/app/[locale]/admin/pages/[id]/page.tsx` implementing the full split-view editor as described above.

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "admin/pages/\[id\]" || echo "no errors"
git add 'src/app/[locale]/admin/pages/[id]/page.tsx'
git commit -m "feat(pages): visual editor with split-view + drag-and-drop"
```

---

## Task 12: Admin sidebar menu update + cleanup

**Files:**
- Modify: `src/components/admin/Sidebar.tsx` (change "Home widgets" → "Pages" menu item)
- Remove: `src/app/[locale]/admin/home-widgets/page.tsx`
- Remove: `src/app/api/admin/home-widgets/` (all files)

- [ ] **Step 1: Update admin sidebar menu**

In `src/components/admin/Sidebar.tsx`, find the menu item for "Home widgets" and change it to "Pages" pointing to `/admin/pages`. The exact location depends on how the sidebar renders menu items — search for `home-widgets` or `homeWidgets` in the file and update the label and path.

- [ ] **Step 2: Remove old admin home-widgets page**

```bash
rm src/app/\[locale\]/admin/home-widgets/page.tsx
```

- [ ] **Step 3: Remove old admin API routes**

```bash
rm -rf src/app/api/admin/home-widgets/
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "home-widgets|Sidebar" || echo "no errors"
git add -A
git commit -m "refactor(pages): replace home-widgets admin with pages, remove old routes"
```

---

## Task 13: Locale updates for admin pages

**Files:**
- Modify: `src/locales/en.json` and `src/locales/ko.json`

Add locale keys for the new Pages admin under the `admin` namespace. The exact keys depend on what Tasks 10-11 use. At minimum:

```json
{
  "admin": {
    "pages": "Pages",
    "pageList": "Pages",
    "newPage": "New Page",
    "editPage": "Edit Page",
    "pageTitle": "Title",
    "pageSlug": "URL Slug",
    "pageTemplate": "Layout Template",
    "pageActive": "Active",
    "pageSeo": "SEO Settings",
    "saveLayout": "Save Layout",
    "addRegistryWidget": "Add Widget",
    "addContentWidget": "Add Content",
    "widgetSettings": "Widget Settings",
    "cannotDeleteHome": "Cannot delete the Home page",
    "confirmDeletePage": "Delete this page and all its widgets?",
    "slugReserved": "This URL is reserved",
    "slugInUse": "This URL is already in use"
  }
}
```

- [ ] **Step 1: Add locale keys to en.json and ko.json**

- [ ] **Step 2: Regenerate merged locales and commit**

```bash
node scripts/scan-plugins.js
git add src/locales/
git commit -m "i18n(pages): add admin page builder locale keys"
```

---

## Task 14: Final build, scan, and verification

- [ ] **Step 1: Run scan-plugins**

```bash
node scripts/scan-plugins.js
```

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: build succeeds, all new routes appear.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Manual verification checklist**

Run `npm run dev` and walk through the spec's section 12 (Manual Verification Checklist):

- Migration data preserved
- Page CRUD works
- Visual editor drag-and-drop
- All 6 content widget types
- SEO metadata
- Layout templates
- Public custom page rendering
- Backward compat (`/api/home-widgets`, sidebar widgets)
- Reserved slug validation

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(pages): final build verification and fixes"
```
