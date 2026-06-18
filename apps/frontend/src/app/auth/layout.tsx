import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-neutral-950 via-stone-900 to-neutral-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-sm font-black tracking-tight">
            M
          </div>
          <span className="text-lg font-semibold tracking-tight">OneMDR</span>
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-4">
            <p className="text-2xl font-medium leading-relaxed text-white/90">
              &ldquo;OneMDR gave us enterprise-grade detection engineering overnight. One platform,
              every tool our SOC needs &mdash; detections, hunting, coverage.&rdquo;
            </p>
            <footer className="space-y-1">
              <p className="text-sm font-semibold text-white">Sarah Chen</p>
              <p className="text-xs text-white/50">VP Security Operations &middot; Meridian Labs</p>
            </footer>
          </blockquote>
        </div>

        <div className="flex gap-8 text-xs text-white/40">
          <span>SOC 2 Type II</span>
          <span>GDPR Compliant</span>
          <span>99.9% SLA</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-xs font-black text-white">
            M
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">OneMDR</span>
        </div>

        {children}
      </div>
    </div>
  );
}
