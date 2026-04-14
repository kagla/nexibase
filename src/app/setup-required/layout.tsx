export default function SetupRequiredLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Nexibase — Setup Required</title>
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">{children}</div>
        </div>
      </body>
    </html>
  )
}
