import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

interface SectionProps {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Section({ title, action, children, className, id }: SectionProps) {
  return (
    <section className={className} aria-labelledby={id}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="group -my-2 -mr-2 inline-flex min-h-10 items-center gap-0.5 rounded-lg px-2 text-[13px] font-medium text-fg-muted hover:text-fg"
          >
            {action.label}
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('surface', className)}>{children}</div>;
}
