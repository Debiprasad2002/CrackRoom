import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, ExternalLink, FileText, FileX } from 'lucide-react';
import type { Resource } from '@/types';
import { SUBJECTS, examLabel, levelLabel } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/date';
import { useAsync } from '@/hooks/useAsync';
import { downloadUrl, notesService } from '@/services/notesService';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink, buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { ResourceRow } from '@/features/notes/ResourceCard';

export default function NoteDetailPage() {
  const { resourceId = '' } = useParams();
  const { data: resource, loading, error, retry } = useAsync(() => notesService.get(resourceId), [resourceId]);

  return (
    <div className="space-y-6">
      <Link to="/notes" className="-my-2 inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Notes library
      </Link>
      {error ? (
        <Card>
          <ErrorState onRetry={retry} />
        </Card>
      ) : loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !resource ? (
        <Card>
          <EmptyState
            icon={<FileX />}
            title="Resource not available"
            description="It may have been unpublished or the link is incorrect."
            action={<ButtonLink to="/notes" variant="secondary">Back to library</ButtonLink>}
          />
        </Card>
      ) : (
        <ResourceView resource={resource} />
      )}
    </div>
  );
}

function ResourceView({ resource }: { resource: Resource }) {
  const all = useAsync(() => notesService.list(), []);
  const related = useMemo(
    () => (all.data ?? []).filter((r) => r.subject === resource.subject && r.id !== resource.id).slice(0, 4),
    [all.data, resource],
  );
  const subject = SUBJECTS[resource.subject];

  return (
    <>
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-fg-muted">
            <span className={cn('size-2 rounded-full', subject.dot)} aria-hidden />
            {subject.label} · {resource.chapter}
          </p>
          <h1 className="mt-2 text-[1.625rem] font-semibold leading-tight sm:text-[2rem]">{resource.title}</h1>
          <p className="mt-2 max-w-2xl text-fg-muted">{resource.description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {resource.fileUrl ? (
            <>
              <a href={resource.fileUrl} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>
                <ExternalLink aria-hidden />
                Open
              </a>
              <a href={downloadUrl(resource.fileUrl)} className={buttonClass('primary')}>
                <Download aria-hidden />
                Download
              </a>
            </>
          ) : (
            <button type="button" disabled className={buttonClass('secondary')} aria-describedby="no-file-reason">
              <Download aria-hidden />
              Download
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          {resource.fileUrl ? (
            <iframe title={`${resource.title} (PDF)`} src={resource.fileUrl} loading="lazy" className="h-[75vh] w-full bg-ink-950" />
          ) : (
            <div className="flex aspect-[4/5] max-h-[70vh] w-full flex-col items-center justify-center bg-ink-850 px-6 text-center sm:aspect-[4/3]">
              <span className={cn('flex size-14 items-center justify-center rounded-2xl border', subject.tile)} aria-hidden>
                <FileText className="size-6" />
              </span>
              <p className="mt-4 font-medium text-fg">PDF not uploaded yet</p>
              <p id="no-file-reason" className="mt-1 max-w-sm text-sm text-fg-muted">
                This is a sample catalogue entry. The viewer and download switch on automatically once the file is published to protected storage.
              </p>
            </div>
          )}
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-sans text-sm font-semibold">Details</h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              {[
                ['Exam', <Badge key="e" tone="violet">{examLabel(resource.exam)}</Badge>],
                ['Class', levelLabel(resource.level)],
                ['Subject', subject.label],
                ['Chapter', resource.chapter],
                ['Language', resource.language],
                ['Format', `${resource.fileType}${resource.pages ? ` · ${resource.pages} pages` : ''}`],
                ['Published', fmt.date(resource.publishedAt)],
                ['Source', resource.source],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-fg-subtle">{label}</dt>
                  <dd className="text-right font-medium text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {related.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 font-sans text-sm font-semibold">More in {subject.label}</h2>
              <Card className="p-1.5">
                <div className="divide-y divide-line">
                  {related.map((r) => (
                    <ResourceRow key={r.id} resource={r} />
                  ))}
                </div>
              </Card>
            </div>
          )}
          <Link to={`/notes?subject=${resource.subject}`} className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-fg-muted hover:text-fg [@media(pointer:coarse)]:min-h-10">
            <BookOpen className="size-3.5" aria-hidden />
            All {subject.label} notes
          </Link>
        </aside>
      </div>
    </>
  );
}
