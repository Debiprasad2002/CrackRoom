import type { ReactNode } from 'react';
import { BookOpen, DoorOpen, Timer } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

/** The left-hand campus panel shared by onboarding and the account screens. */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-line bg-ink-850 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        className="pointer-events-none absolute -left-24 top-1/3 size-[28rem] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.14), transparent 65%)' }}
        aria-hidden
      />
      <Logo size="lg" />
      <div className="relative">
        <h2 className="max-w-sm text-[2.5rem] font-semibold leading-[1.08]">
          Study together.
          <br />
          <span className="text-violet-300">Crack it together.</span>
        </h2>
        <ul className="mt-10 space-y-5 text-fg-muted">
          {[
            { icon: DoorOpen, text: 'Join study rooms built around your exam, class and subjects.' },
            { icon: BookOpen, text: 'Find curated notes organised by chapter.' },
            { icon: Timer, text: 'Run focus blocks and watch your consistency build.' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex max-w-sm items-start gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-ink-700 text-violet-300">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="pt-1.5 text-[15px]">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-fg-subtle">For JEE and NEET aspirants across India.</p>
    </aside>
  );
}

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BrandPanel />
      <main className="flex flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:justify-center lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-2 text-fg-muted">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** A form-level error, announced to screen readers when it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-300">
      {children}
    </p>
  );
}
