import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Film, ImageIcon, MessagesSquare, Send, Sparkles } from 'lucide-react';
import type { CommunityPost, ReactionKind } from '@/types';
import { cn } from '@/lib/cn';
import { communityService } from '@/services/communityService';
import type { ReportReason } from '@/services/roomsService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { ApiError, errorMessage } from '@/services/http';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Choice';
import { useToast } from '@/components/ui/Toast';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { PostCard } from '@/features/community/PostCard';

const MAX = 1000;
const POLL_MS = 30_000;

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Community"
        description="Share how your preparation is going: wins, struggles, tips. Cheer each other on."
      />
      {USING_SAMPLE_DATA ? (
        <Card>
          <EmptyState icon={<MessagesSquare />} title="The community needs the CrackRoom server" description="Posts are shared with other students, so this works once the API is connected." />
        </Card>
      ) : (
        <Feed />
      )}
    </div>
  );
}

function Feed() {
  const notify = useToast();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [fresh, setFresh] = useState<CommunityPost[] | null>(null);
  const [resharing, setResharing] = useState<CommunityPost | null>(null);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [deleting, setDeleting] = useState<CommunityPost | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const topId = posts[0]?.id;

  const load = useCallback(async () => {
    setStatus('loading');
    setFresh(null);
    try {
      const page = await communityService.feed({ mine: tab === 'mine' });
      setPosts(page.results);
      setNext(page.next);
      setStatus('ready');
    } catch (e) {
      setError(errorMessage(e));
      setStatus('error');
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  // Check quietly for newer posts and offer them, instead of jumping the feed under the reader.
  useEffect(() => {
    if (status !== 'ready' || tab !== 'all') return;
    const id = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const page = await communityService.feed();
        if (page.results[0] && page.results[0].id !== topId) setFresh(page.results);
      } catch {
        /* try again next time */
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [status, tab, topId]);

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await communityService.feed({ before: next, mine: tab === 'mine' });
      setPosts((prev) => [...prev, ...page.results.filter((p) => !prev.some((q) => q.id === p.id))]);
      setNext(page.next);
    } catch (e) {
      notify({ tone: 'error', title: 'Could not load more', description: errorMessage(e) });
    } finally {
      setLoadingMore(false);
    }
  }, [next, loadingMore, tab, notify]);

  // Infinite scroll: fetch the next page as the reader nears the end.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && void loadMore(), { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [next, loadMore]);

  function replace(updated: CommunityPost) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function react(post: CommunityPost, kind: ReactionKind) {
    // Optimistic: flip the reaction now, then take the server's counts.
    const removing = post.myReaction === kind;
    const reactions = { ...post.reactions };
    if (post.myReaction) reactions[post.myReaction] -= 1;
    if (!removing) reactions[kind] += 1;
    replace({ ...post, reactions, myReaction: removing ? null : kind });
    try {
      replace(removing ? await communityService.unreact(post.id) : await communityService.react(post.id, kind));
    } catch (e) {
      replace(post);
      notify({ tone: 'error', title: 'Reaction not saved', description: errorMessage(e) });
    }
  }

  return (
    <>
      <Composer onPosted={(p) => setPosts((prev) => [p, ...prev])} />

      <Segmented
        label="Feed"
        className="w-full sm:w-auto"
        value={tab}
        options={[
          { value: 'all', label: 'Everyone' },
          { value: 'mine', label: 'My posts' },
        ]}
        onChange={(v) => setTab(v as 'all' | 'mine')}
      />

      {fresh && (
        <div className="sticky top-16 z-20 flex justify-center md:top-4">
          <button
            type="button"
            onClick={() => {
              setPosts(fresh);
              setFresh(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-violet-500 px-4 text-sm font-semibold text-white shadow-pop"
          >
            <ArrowUp className="size-4" aria-hidden />
            New posts
          </button>
        </div>
      )}

      {status === 'error' ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : status === 'loading' ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles />}
            title={tab === 'mine' ? 'You haven’t posted yet' : 'Be the first to share'}
            description={tab === 'mine' ? 'Share a win from today, however small.' : 'Post how your study day went and start the conversation.'}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReact={(kind) => react(post, kind)}
              onReshare={() => setResharing(post)}
              onDelete={() => setDeleting(post)}
              onReport={() => setReporting({ type: 'post', id: post.id })}
              onReportComment={(c) => setReporting({ type: 'comment', id: c.id })}
              onCommentCount={(delta) => setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentCount: Math.max(0, p.commentCount + delta) } : p)))}
            />
          ))}
          <div ref={sentinel} />
          {loadingMore && <Skeleton className="h-36 rounded-2xl" />}
          {!next && posts.length > 5 && <p className="py-4 text-center text-sm text-fg-subtle">You’re all caught up.</p>}
        </div>
      )}

      <ReshareDialog
        post={resharing}
        onClose={() => setResharing(null)}
        onDone={(created) => {
          const from = created.resharedFrom;
          const originalId = from && !('removed' in from) ? from.id : null;
          setPosts((prev) => [created, ...prev.map((p) => (p.id === originalId ? { ...p, reshareCount: p.reshareCount + 1 } : p))]);
          setResharing(null);
        }}
      />
      <ReportDialog target={reporting} onClose={() => setReporting(null)} />
      <Dialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Delete this post?"
        description="It disappears from the community. Reshares will show that the original was removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await communityService.remove(deleting.id);
                  setPosts((prev) => prev.filter((p) => p.id !== deleting.id));
                  notify({ title: 'Post deleted' });
                } catch (e) {
                  notify({ tone: 'error', title: 'Not deleted', description: errorMessage(e) });
                }
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

function Composer({ onPosted }: { onPosted: (post: CommunityPost) => void }) {
  const { profile } = useRequiredProfile();
  const notify = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const left = MAX - body.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      onPosted(await communityService.create(body));
      setBody('');
      notify({ tone: 'success', title: 'Posted to the community' });
    } catch (err) {
      notify({ tone: 'error', title: 'Not posted', description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={cn('surface p-4 transition-shadow sm:p-5', focused && 'ring-2 ring-violet-400/40')}>
      <div className="flex gap-3">
        <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="md" />
        <div className="min-w-0 flex-1">
          <label htmlFor="composer" className="sr-only">
            Write a post
          </label>
          <textarea
            id="composer"
            value={body}
            maxLength={MAX}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={body ? 4 : 2}
            placeholder={`What’s on your mind, ${profile.displayName.split(' ')[0]}?`}
            className="w-full resize-none border-0 bg-transparent p-0 pt-2 text-[15px] leading-relaxed text-fg placeholder:text-fg-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-1">
          {[
            { icon: ImageIcon, label: 'Photo' },
            { icon: Film, label: 'Video' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-fg-subtle" title={`${label}s are coming soon`}>
              <Icon className="size-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
              <span className="rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Soon</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {body.length > MAX - 150 && <span className={cn('text-xs tabular', left < 30 ? 'text-rose-400' : 'text-fg-subtle')}>{left}</span>}
          <Button type="submit" disabled={!body.trim() || busy}>
            <Send aria-hidden />
            {busy ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ReshareDialog({ post, onClose, onDone }: { post: CommunityPost | null; onClose: () => void; onDone: (created: CommunityPost) => void }) {
  const notify = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<CommunityPost | null>(null);
  if (post !== last) {
    setLast(post);
    setBody('');
    setBusy(false);
  }
  const original = post && post.resharedFrom && !('removed' in post.resharedFrom) ? post.resharedFrom : post;

  async function submit() {
    if (!post) return;
    setBusy(true);
    try {
      onDone(await communityService.reshare(post.id, body));
      notify({ tone: 'success', title: 'Reshared to the community' });
    } catch (e) {
      notify({ tone: 'error', title: 'Not reshared', description: errorMessage(e) });
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={post != null}
      onClose={onClose}
      title="Reshare"
      description="Add your thoughts on top, or reshare as it is."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Resharing…' : 'Reshare'}
          </Button>
        </>
      }
    >
      <Field label="Your comment" hint="Optional">
        {({ id, describedBy }) => (
          <Textarea id={id} aria-describedby={describedBy} value={body} maxLength={MAX} onChange={(e) => setBody(e.target.value)} placeholder="Why this resonated with you…" className="min-h-20" />
        )}
      </Field>
      {original && (
        <div className="mt-4 rounded-2xl border border-line bg-ink-850 p-4">
          <p className="text-sm font-semibold text-fg">{original.author.name}</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-fg-muted">{original.body}</p>
        </div>
      )}
    </Dialog>
  );
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'cheating', label: 'Sharing leaked papers or cheating' },
  { value: 'other', label: 'Something else' },
];

type ReportTarget = { type: 'post' | 'comment'; id: number };

function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const notify = useToast();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ReportTarget | null>(null);
  if (target !== last) {
    setLast(target);
    setReason('');
    setBusy(false);
  }

  async function submit() {
    if (!target || !reason) return;
    setBusy(true);
    try {
      if (target.type === 'post') await communityService.report(target.id, reason, '');
      else await communityService.reportComment(target.id, reason);
      notify({ tone: 'success', title: 'Report sent', description: 'Moderators will review it. The author is not told who reported.' });
    } catch (e) {
      notify(e instanceof ApiError && e.status === 409 ? { title: 'Already reported', description: e.message } : { tone: 'error', title: 'Not sent', description: errorMessage(e) });
    }
    onClose();
  }

  return (
    <Dialog
      open={target != null}
      onClose={onClose}
      size="sm"
      title={target?.type === 'comment' ? 'Report this comment' : 'Report this post'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={!reason || busy}>
            Submit report
          </Button>
        </>
      }
    >
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Reason</legend>
        {REASONS.map((r) => (
          <label
            key={r.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm transition-colors',
              reason === r.value ? 'border-violet-400/60 bg-violet-500/[0.08] text-fg' : 'border-line-strong text-fg-muted hover:border-ink-500',
            )}
          >
            <input type="radio" name="post-report" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-4 accent-violet-500" />
            {r.label}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
