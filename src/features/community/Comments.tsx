import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { CornerDownRight, SendHorizontal, X } from 'lucide-react';
import type { PostComment } from '@/types';
import { cn } from '@/lib/cn';
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
  /** A comment to scroll to and highlight, when opened from a notification. */
  highlightId?: number;
}

/** One level of nesting keeps threads readable on phones: replies to replies sit under the same comment. */
function toThreads(comments: PostComment[]) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const rootOf = (comment: PostComment) => {
    let current = comment;
    while (current.parentId != null && byId.has(current.parentId)) current = byId.get(current.parentId)!;
    return current;
  };
  const replies = new Map<number, PostComment[]>();
  const roots: PostComment[] = [];
  for (const comment of comments) {
    const root = rootOf(comment);
    if (root.id === comment.id) roots.push(comment);
    else replies.set(root.id, [...(replies.get(root.id) ?? []), comment]);
  }
  return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
}

/** The thread under a post: oldest first, with a reply box at the bottom. */
export function Comments({ postId, onCountChange, onReport, highlightId }: CommentsProps) {
  const { profile } = useRequiredProfile();
  const notify = useToast();
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [failed, setFailed] = useState<string>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const threads = useMemo(() => toThreads(comments ?? []), [comments]);

  useEffect(() => {
    let cancelled = false;
    communityService.comments(postId).then(
      (list) => !cancelled && setComments(list),
      (e) => !cancelled && setFailed(errorMessage(e)),
    );
    if (highlightId == null) input.current?.focus({ preventScroll: true });
    return () => {
      cancelled = true;
    };
  }, [postId, highlightId]);

  function startReply(comment: PostComment) {
    setReplyTo(comment);
    input.current?.focus();
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const created = await communityService.addComment(postId, body, replyTo?.id);
      setComments((list) => [...(list ?? []), created]);
      onCountChange(1);
      setDraft('');
      setReplyTo(null);
    } catch (err) {
      notify({ tone: 'error', title: replyTo ? 'Reply not posted' : 'Comment not posted', description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: PostComment) {
    const before = comments;
    // Replies stay when their parent goes, the same as on the server.
    setComments((list) =>
      (list ?? []).filter((c) => c.id !== comment.id).map((c) => (c.parentId === comment.id ? { ...c, parentId: null, replyToName: null } : c)),
    );
    if (replyTo?.id === comment.id) setReplyTo(null);
    onCountChange(-1);
    try {
      await communityService.deleteComment(comment.id);
    } catch (err) {
      setComments(before);
      onCountChange(1);
      notify({ tone: 'error', title: 'Comment not removed', description: errorMessage(err) });
    }
  }

  const row = (comment: PostComment, nested?: { root: PostComment }) => (
    <CommentRow
      key={comment.id}
      comment={comment}
      // A reply directly under the comment it answers needs no "replying to" line.
      showReplyTo={nested != null && comment.parentId !== nested.root.id}
      highlighted={comment.id === highlightId}
      onReply={() => startReply(comment)}
      onDelete={() => remove(comment)}
      onReport={() => onReport(comment)}
    />
  );

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
            {threads.map(({ root, replies }) => (
              <li key={root.id}>
                {row(root)}
                {replies.length > 0 && (
                  <ul className="ml-[1.125rem] mt-2 space-y-2.5 border-l-2 border-line pl-3" aria-label={`Replies to ${root.author.name}`}>
                    {replies.map((reply) => (
                      <li key={reply.id}>{row(reply, { root })}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={send} className="pt-1">
          {replyTo && (
            <p className="mb-1.5 flex items-center gap-1.5 pl-[2.625rem] text-xs text-fg-muted">
              <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                Replying to <span className="font-semibold text-fg">{replyTo.author.isYou ? 'yourself' : replyTo.author.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:bg-ink-700 hover:text-fg"
                aria-label="Cancel reply"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="sm" />
            <label htmlFor={`comment-${postId}`} className="sr-only">
              {replyTo ? `Reply to ${replyTo.author.name}` : 'Write a comment'}
            </label>
            <input
              ref={input}
              id={`comment-${postId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder={replyTo ? `Reply to ${replyTo.author.name}…` : 'Write a comment…'}
              className="h-10 min-w-0 flex-1 rounded-full border border-line-strong bg-ink-800 px-4 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400 focus-visible:ring-offset-0"
            />
            <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() || busy} aria-label={replyTo ? 'Send reply' : 'Send comment'}>
              <SendHorizontal aria-hidden />
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

interface CommentRowProps {
  comment: PostComment;
  showReplyTo: boolean;
  highlighted: boolean;
  onReply: () => void;
  onDelete: () => void;
  onReport: () => void;
}

function CommentRow({ comment: c, showReplyTo, highlighted, onReply, onDelete, onReport }: CommentRowProps) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) element.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  return (
    <div ref={element} className="flex gap-2.5">
      <Avatar name={c.author.name} hue={c.author.hue ?? undefined} avatar={c.author.avatar} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className={cn('inline-block max-w-full rounded-2xl rounded-tl-md bg-ink-800 px-3.5 py-2 shadow-card ring-1 ring-line', highlighted && 'ring-2 ring-violet-400')}>
          <p className="text-[13px] font-semibold text-fg">
            {c.author.name}
            {c.author.isYou && <span className="font-normal text-fg-subtle"> · you</span>}
          </p>
          {showReplyTo && c.replyToName && <p className="text-xs text-fg-subtle">Replying to {c.replyToName}</p>}
          <p className="whitespace-pre-line break-words text-sm leading-snug text-fg">{c.body}</p>
        </div>
        <div className="mt-0.5 flex items-center gap-3 px-2 text-xs text-fg-subtle">
          <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
          <button type="button" onClick={onReply} className="inline-flex min-h-8 items-center font-medium hover:text-violet-300" aria-label={`Reply to ${c.author.name}`}>
            Reply
          </button>
          {c.canDelete ? (
            <button type="button" onClick={onDelete} className="inline-flex min-h-8 items-center font-medium hover:text-rose-400">
              Delete
            </button>
          ) : (
            <button type="button" onClick={onReport} className="inline-flex min-h-8 items-center font-medium hover:text-fg">
              Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
