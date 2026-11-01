import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { SendHorizontal } from 'lucide-react';
import type { PostComment } from '@/types';
import { communityService } from '@/services/communityService';
import { errorMessage } from '@/services/http';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { timeAgo } from './PostCard';

interface CommentsProps {
  postId: number;
  /** Keeps the post's comment count in step with what happens here. */
  onCountChange: (delta: number) => void;
  onReport: (comment: PostComment) => void;
}

/** The thread under a post: oldest first, with a reply box at the bottom. */
export function Comments({ postId, onCountChange, onReport }: CommentsProps) {
  const { profile } = useRequiredProfile();
  const notify = useToast();
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [failed, setFailed] = useState<string>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    communityService.comments(postId).then(
      (list) => !cancelled && setComments(list),
      (e) => !cancelled && setFailed(errorMessage(e)),
    );
    input.current?.focus({ preventScroll: true });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const created = await communityService.addComment(postId, body);
      setComments((list) => [...(list ?? []), created]);
      onCountChange(1);
      setDraft('');
    } catch (err) {
      notify({ tone: 'error', title: 'Comment not posted', description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: PostComment) {
    const before = comments;
    setComments((list) => (list ?? []).filter((c) => c.id !== comment.id));
    onCountChange(-1);
    try {
      await communityService.deleteComment(comment.id);
    } catch (err) {
      setComments(before);
      onCountChange(1);
      notify({ tone: 'error', title: 'Comment not removed', description: errorMessage(err) });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="overflow-hidden border-t border-line bg-ink-850/60"
    >
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {failed ? (
          <p className="text-sm text-fg-muted">{failed}</p>
        ) : comments == null ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-12 w-3/4 rounded-2xl" />
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-fg-subtle">No comments yet. Start the conversation.</p>
        ) : (
          <ul className="space-y-3" aria-label="Comments">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar name={c.author.name} hue={c.author.hue ?? undefined} avatar={c.author.avatar} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="inline-block max-w-full rounded-2xl rounded-tl-md bg-ink-800 px-3.5 py-2 shadow-card ring-1 ring-line">
                    <p className="text-[13px] font-semibold text-fg">
                      {c.author.name}
                      {c.author.isYou && <span className="font-normal text-fg-subtle"> · you</span>}
                    </p>
                    <p className="whitespace-pre-line break-words text-sm leading-snug text-fg">{c.body}</p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 px-2 text-xs text-fg-subtle">
                    <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
                    {c.canDelete ? (
                      <button type="button" onClick={() => remove(c)} className="inline-flex min-h-8 items-center font-medium hover:text-rose-400">
                        Delete
                      </button>
                    ) : (
                      <button type="button" onClick={() => onReport(c)} className="inline-flex min-h-8 items-center font-medium hover:text-fg">
                        Report
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={send} className="flex items-center gap-2.5 pt-1">
          <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="sm" />
          <label htmlFor={`comment-${postId}`} className="sr-only">
            Write a comment
          </label>
          <input
            ref={input}
            id={`comment-${postId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            autoComplete="off"
            placeholder="Write a comment…"
            className="h-10 min-w-0 flex-1 rounded-full border border-line-strong bg-ink-800 px-4 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400 focus-visible:ring-offset-0"
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() || busy} aria-label="Send comment">
            <SendHorizontal aria-hidden />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
