import { useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Flame, Heart, Lightbulb, MessageCircle, MoreHorizontal, Repeat2, Trash2, type LucideIcon } from 'lucide-react';
import type { CommunityPost, PostAuthor, PostComment, ReactionKind } from '@/types';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/date';
import { Avatar } from '@/components/ui/Avatar';
import { Comments } from './Comments';

export const REACTIONS: { kind: ReactionKind; label: string; icon: LucideIcon; on: string }[] = [
  { kind: 'like', label: 'Like', icon: Heart, on: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-400/40 [&_svg]:fill-current' },
  { kind: 'fire', label: 'Motivating', icon: Flame, on: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-400/40 [&_svg]:fill-current' },
  { kind: 'idea', label: 'Helpful', icon: Lightbulb, on: 'text-amber-600 dark:text-amber-300 bg-amber-400/15 border-amber-400/50 [&_svg]:fill-current' },
];

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return fmt.short(iso);
}

function AuthorLine({ author, createdAt, size = 'md' }: { author: PostAuthor; createdAt: string; size?: 'sm' | 'md' }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={author.name} hue={author.hue ?? undefined} avatar={author.avatar} size={size === 'sm' ? 'sm' : 'md'} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight text-fg">
          {author.name}
          {author.isYou && <span className="font-normal text-fg-subtle"> · you</span>}
        </p>
        <p className="truncate text-xs text-fg-subtle">
          {[author.exam, author.level].filter(Boolean).join(' · ')}
          {(author.exam || author.level) && ' · '}
          <time dateTime={createdAt} title={new Date(createdAt).toLocaleString('en-IN')}>
            {timeAgo(createdAt)}
          </time>
        </p>
      </div>
    </div>
  );
}

/** Long posts open fully on tap, so the feed stays scannable. */
function Body({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320;
  return (
    <div className={className}>
      <p className={cn('whitespace-pre-line break-words text-[15px] leading-relaxed text-fg', long && !open && 'line-clamp-5')}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 inline-flex min-h-8 items-center text-sm font-medium text-violet-300 hover:text-violet-700">
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

interface PostCardProps {
  post: CommunityPost;
  onReact: (kind: ReactionKind) => void;
  onReshare: () => void;
  onDelete: () => void;
  onReport: () => void;
  onReportComment: (comment: PostComment) => void;
  onCommentCount: (delta: number) => void;
  /** Opens the thread straight away and points at one comment, when arriving from a notification. */
  openComments?: boolean;
  highlightCommentId?: number;
}

export function PostCard({ post, onReact, onReshare, onDelete, onReport, onReportComment, onCommentCount, openComments, highlightCommentId }: PostCardProps) {
  const [menu, setMenu] = useState(false);
  const [showComments, setShowComments] = useState(openComments ?? false);
  const total = post.reactions.like + post.reactions.fire + post.reactions.idea;
  const original = post.resharedFrom;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface overflow-hidden"
    >
      {post.isReshare && (
        <p className="flex items-center gap-1.5 border-b border-line bg-ink-850 px-4 py-2 text-xs font-medium text-fg-muted sm:px-5">
          <Repeat2 className="size-3.5 text-mint-400" aria-hidden />
          {post.author.isYou ? 'You' : post.author.name} reshared
        </p>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <AuthorLine author={post.author} createdAt={post.createdAt} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              onBlur={() => window.setTimeout(() => setMenu(false), 150)}
              className="-mr-2 -mt-1 flex size-10 items-center justify-center rounded-full text-fg-subtle hover:bg-ink-700 hover:text-fg"
              aria-label="Post options"
              aria-expanded={menu}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
            {menu && (
              <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-line-strong bg-ink-800 py-1 shadow-pop">
                {post.canDelete ? (
                  <MenuItem icon={Trash2} label="Delete post" danger onClick={onDelete} />
                ) : (
                  <MenuItem icon={Flag} label="Report post" onClick={onReport} />
                )}
              </div>
            )}
          </div>
        </div>

        {post.body && <Body text={post.body} className="mt-3" />}

        {original && (
          'removed' in original ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line-strong bg-ink-850 p-4 text-sm text-fg-subtle">
              The original post was removed.
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-line bg-ink-850 p-4">
              <AuthorLine author={original.author} createdAt={original.createdAt} size="sm" />
              <Body text={original.body} className="mt-2" />
            </div>
          )
        )}

        {(total > 0 || post.reshareCount > 0 || post.commentCount > 0) && (
          <p className="mt-3 flex items-center gap-3 text-xs text-fg-subtle">
            {total > 0 && (
              <span className="flex items-center gap-1">
                <span className="flex -space-x-1">
                  {REACTIONS.filter((r) => post.reactions[r.kind] > 0).map((r) => (
                    <span key={r.kind} className={cn('flex size-5 items-center justify-center rounded-full border-2 border-ink-800', r.on)}>
                      <r.icon className="size-2.5" aria-hidden />
                    </span>
                  ))}
                </span>
                {total} {total === 1 ? 'reaction' : 'reactions'}
              </span>
            )}
            {post.commentCount > 0 && (
              <button type="button" onClick={() => setShowComments(true)} className="hover:text-fg hover:underline">
                {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
              </button>
            )}
            {post.reshareCount > 0 && (
              <span>
                {post.reshareCount} {post.reshareCount === 1 ? 'reshare' : 'reshares'}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2.5 sm:px-4">
        {REACTIONS.map((r) => {
          const on = post.myReaction === r.kind;
          return (
            <motion.button
              key={r.kind}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => onReact(r.kind)}
              aria-pressed={on}
              aria-label={`${r.label}${post.reactions[r.kind] ? `, ${post.reactions[r.kind]}` : ''}`}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors [@media(pointer:coarse)]:h-10',
                on ? r.on : 'border-transparent text-fg-muted hover:bg-ink-700 hover:text-fg',
              )}
            >
              <r.icon className="size-4" aria-hidden />
              <span className="hidden sm:inline">{r.label}</span>
              {post.reactions[r.kind] > 0 && <span className="tabular">{post.reactions[r.kind]}</span>}
            </motion.button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className={cn(
            'ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors [@media(pointer:coarse)]:h-10',
            showComments ? 'bg-violet-500/10 text-violet-300' : 'text-fg-muted hover:bg-violet-500/10 hover:text-violet-300',
          )}
        >
          <MessageCircle className="size-4" aria-hidden />
          <span className="hidden sm:inline">Comment</span>
          {post.commentCount > 0 && <span className="tabular">{post.commentCount}</span>}
        </button>
        <button
          type="button"
          onClick={onReshare}
          disabled={post.isReshare && original != null && 'removed' in original}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-muted transition-colors hover:bg-mint-400/10 hover:text-mint-400 disabled:opacity-40 [@media(pointer:coarse)]:h-10"
          aria-label="Reshare"
        >
          <Repeat2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Reshare</span>
        </button>
      </div>
      {showComments && <Comments postId={post.id} onCountChange={onCommentCount} onReport={onReportComment} highlightId={highlightCommentId} />}
    </motion.article>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('flex h-11 w-full items-center gap-2.5 px-3.5 text-left text-sm hover:bg-ink-700', danger ? 'text-rose-400' : 'text-fg')}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}
