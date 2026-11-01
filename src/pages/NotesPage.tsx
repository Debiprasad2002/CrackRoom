import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, SearchX } from 'lucide-react';
import type { Resource, Subject } from '@/types';
import { CHAPTERS, EXAMS, LEVELS, SUBJECTS } from '@/data/catalog';
import { useAsync } from '@/hooks/useAsync';
import { notesService } from '@/services/notesService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Layout';
import { EmptyState, ErrorState, PrototypeNote, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { FilterBar } from '@/components/ui/FilterBar';
import { ResourceCard } from '@/features/notes/ResourceCard';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { resourceRelevance } from '@/features/rooms/roomMeta';

const KEYS = ['q', 'exam', 'level', 'subject', 'chapter'] as const;
type Filters = Record<(typeof KEYS)[number], string>;

function matches(r: Resource, f: Filters) {
  const q = f.q.trim().toLowerCase();
  if (q && !`${r.title} ${r.description} ${r.chapter}`.toLowerCase().includes(q)) return false;
  if (f.exam && r.exam !== 'both' && r.exam !== f.exam) return false;
  if (f.level && r.level !== 'all' && r.level !== f.level) return false;
  if (f.subject && r.subject !== f.subject) return false;
  if (f.chapter && r.chapter !== f.chapter) return false;
  return true;
}

export default function NotesPage() {
  const { profile } = useRequiredProfile();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, retry } = useAsync(() => notesService.list(), []);
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])) as Filters;
  const active = KEYS.filter((k) => filters[k]).length;

  function setFilter(key: (typeof KEYS)[number], value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        // A chapter only makes sense within its subject.
        if (key === 'subject') next.delete('chapter');
        return next;
      },
      { replace: true },
    );
  }

  const results = useMemo(
    () =>
      (data ?? [])
        .filter((r) => matches(r, filters))
        .sort((a, b) => resourceRelevance(b, profile) - resourceRelevance(a, profile) || b.publishedAt.localeCompare(a.publishedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, params, profile],
  );

  const chapters = filters.subject ? CHAPTERS[filters.subject as Subject] ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Notes library" description="Curated notes, formula sheets and practice sets, organised by exam, class and chapter." />

      <FilterBar
        label="Search notes"
        query={filters.q}
        onQuery={(v) => setFilter('q', v)}
        placeholder="Search notes or chapters"
        chips={{
          value: filters.subject,
          onChange: (v) => setFilter('subject', v),
          options: Object.entries(SUBJECTS).map(([value, s]) => ({ value, label: s.label, dot: s.dot })),
        }}
        sheetCount={(['exam', 'level', 'chapter'] as const).filter((k) => filters[k]).length}
        activeCount={active}
        onReset={() => setParams({}, { replace: true })}
        summary={!loading && !error && `${results.length} ${results.length === 1 ? 'resource' : 'resources'}`}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select aria-label="Exam" value={filters.exam} onChange={(e) => setFilter('exam', e.target.value)}>
            <option value="">All exams</option>
            {EXAMS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Class" value={filters.level} onChange={(e) => setFilter('level', e.target.value)}>
            <option value="">All classes</option>
            {LEVELS.filter((l) => l.value !== 'other').map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Subject" value={filters.subject} onChange={(e) => setFilter('subject', e.target.value)}>
            <option value="">All subjects</option>
            {Object.entries(SUBJECTS).map(([value, s]) => (
              <option key={value} value={value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Chapter"
            value={filters.chapter}
            onChange={(e) => setFilter('chapter', e.target.value)}
            disabled={!filters.subject}
            title={filters.subject ? undefined : 'Choose a subject to filter by chapter'}
          >
            <option value="">{filters.subject ? 'All chapters' : 'Chapter (pick a subject first)'}</option>
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </FilterBar>

      {error ? (
        <Card>
          <ErrorState onRetry={retry} />
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            icon={data?.length ? <SearchX /> : <BookOpen />}
            title={data?.length ? 'Nothing matches these filters' : 'The library is empty'}
            description={data?.length ? 'Try another chapter or clear the filters to see everything.' : 'Published notes will appear here.'}
            action={
              active > 0 && (
                <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                  Reset filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}

      {USING_SAMPLE_DATA && (
        <PrototypeNote>
          These are sample catalogue entries to show how the library works. No PDF files have been uploaded yet, so viewing and downloading are switched off.
        </PrototypeNote>
      )}
    </div>
  );
}
