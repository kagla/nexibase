import Script from 'next/script'
import { prisma } from '@/lib/prisma'

export async function GoogleAnalytics() {
  let measurementId: string | undefined
  try {
    const row = await prisma.setting.findUnique({
      where: { key: 'google_analytics_id' },
    })
    measurementId = row?.value?.trim() || undefined
  } catch {
    return null
  }

  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  )
}
