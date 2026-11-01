import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { Resource } from '@/types';
import { cn } from '@/lib/cn';
import { SUBJECTS, examLabel, levelLabel } from '@/data/catalog';
import { fmt } from '@/lib/date';
import { Badge } from '@/components/ui/Badge';

function FileGlyph({ resource }: { resource: Resource }) {
  return (
    <span
      className={cn('relative flex size-11 shrink-0 items-center justify-center rounded-xl border', SUBJECTS[resource.subject].tile)}
      aria-hidden
    >
      <FileText className="size-5" />
    </span>
  );
}

export function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <Link
      to={`/notes/${resource.id}`}
      className="surface group flex h-full flex-col p-5 transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-ink-750"
    >
      <div className="flex items-start gap-3.5">
        <FileGlyph resource={resource} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            <span className={cn('size-1.5 rounded-full', SUBJECTS[resource.subject].dot)} aria-hidden />
            {SUBJECTS[resource.subject].label} · {resource.chapter}
          </p>
          <h3 className="mt-1 font-sans text-[15px] font-semibold leading-snug">{resource.title}</h3>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-fg-muted">{resource.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <Badge tone="violet">{examLabel(resource.exam)}</Badge>
        <Badge>{levelLabel(resource.level)}</Badge>
        <Badge>{resource.language}</Badge>
        <span className="ml-auto text-xs text-fg-subtle tabular">
          {resource.fileType}
          {resource.pages ? ` · ${resource.pages} pp` : ''}
        </span>
      </div>
    </Link>
  );
}

/** Dense single-line variant for the dashboard. */
export function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <Link
      to={`/notes/${resource.id}`}
      className="group flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-ink-750"
    >
      <FileGlyph resource={resource} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg group-hover:text-violet-300">{resource.title}</p>
        <p className="mt-0.5 truncate text-xs text-fg-subtle">
          {examLabel(resource.exam)} · {levelLabel(resource.level)} · {SUBJECTS[resource.subject].label} · {resource.chapter}
        </p>
      </div>
      <span className="hidden shrink-0 text-xs text-fg-subtle sm:block">{fmt.short(resource.publishedAt)}</span>
    </Link>
  );
}
