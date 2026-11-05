import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarCheck, CalendarX2, Flame, MessageCircle, Repeat2, Reply, X, type LucideIcon } from 'lucide-react';
import type { AppNotification, NotificationKind } from '@/types';
import { notificationsService } from '@/services/notificationsService';
import { USING_SAMPLE_DATA } from '@/services/config';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { useFocus } from '@/features/focus/FocusContext';

const POLL_MS = 20_000;
const POPUP_MS = 7_000;
const MAX_POPUPS = 3;

export const KIND: Record<NotificationKind, { text: string; icon: LucideIcon; tint: string }> = {
  reply: { text: 'replied to your comment', icon: Reply, tint: 'bg-violet-500' },
  comment: { text: 'commented on your post', icon: MessageCircle, tint: 'bg-cyan-600' },
  reaction: { text: 'reacted to your post', icon: Flame, tint: 'bg-orange-500' },
  reshare: { text: 'reshared your post', icon: Repeat2, tint: 'bg-emerald-600' },
  booking: { text: 'booked a session with you', icon: CalendarCheck, tint: 'bg-violet-500' },
  cancel: { text: 'cancelled your session', icon: CalendarX2, tint: 'bg-rose-600' },
};

export function notificationHref(item: AppNotification) {
  return item.link ?? `/community/posts/${item.postId}${item.commentId ? `?comment=${item.commentId}` : ''}`;
}

/** The sender's avatar with a small badge saying what they did. */
export function NotificationAvatar({ item }: { item: AppNotification }) {
  const { icon: Icon, tint } = KIND[item.kind];
  return (
    <span className="relative shrink-0">
      <Avatar name={item.actor.name} hue={item.actor.hue ?? undefined} avatar={item.actor.avatar} size="md" />
      <span className={cn('absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-ink-800', tint)}>
        <Icon className="size-3" aria-hidden />
      </span>
    </span>
  );
}

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  status: 'loading' | 'ready' | 'error';
  next: number | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: number) => void;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<NotificationsValue['status']>('loading');
  const [popups, setPopups] = useState<AppNotification[]>([]);
  // The newest id already seen. Anything from before this visit counts towards the badge but does not pop up.
  const newestSeen = useRef<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const page = await notificationsService.list();
      const newest = page.results[0]?.id ?? 0;
      if (newestSeen.current != null) {
        const seen = newestSeen.current;
        const fresh = page.results.filter((n) => n.id > seen && !n.read).slice(0, MAX_POPUPS).reverse();
        if (fresh.length) setPopups((list) => [...list, ...fresh].slice(-MAX_POPUPS));
      }
      newestSeen.current = Math.max(newestSeen.current ?? 0, newest);
      // Keep older pages the student has already loaded.
      setItems((list) => {
        const oldest = page.results[page.results.length - 1]?.id ?? 0;
        return [...page.results, ...list.filter((n) => n.id < oldest)];
      });
      setUnread(page.unread);
      setNext((current) => current ?? page.next);
      setStatus('ready');
    } catch {
      // A failed background check just waits for the next one; only a first load shows an error.
      setStatus((current) => (current === 'loading' ? 'error' : current));
    }
  }, []);

  useEffect(() => {
    if (USING_SAMPLE_DATA) {
      setStatus('ready');
      return;
    }
    void reload();
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!next) return;
    const page = await notificationsService.list(next);
    setItems((list) => [...list, ...page.results.filter((n) => !list.some((m) => m.id === n.id))]);
    setNext(page.next);
  }, [next]);

  const markRead = useCallback((id: number) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((count) => Math.max(0, count - 1));
    setPopups((list) => list.filter((n) => n.id !== id));
    // If this fails, the next check restores the true count.
    notificationsService.markRead(id).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead();
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    setPopups([]);
  }, []);

  const value = useMemo(
    () => ({ items, unread, status, next, reload, loadMore, markRead, markAllRead }),
    [items, unread, status, next, reload, loadMore, markRead, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationPopups popups={popups} onDismiss={(id) => setPopups((list) => list.filter((n) => n.id !== id))} onOpen={markRead} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}

/** Message-style pop-ups in the bottom corner, above the phone dock and any running timer. */
function NotificationPopups({ popups, onDismiss, onOpen }: { popups: AppNotification[]; onDismiss: (id: number) => void; onOpen: (id: number) => void }) {
  const { timer } = useFocus();
  return (
    <div
      aria-live="polite"
      aria-label="New notifications"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-3 md:inset-x-auto md:bottom-6 md:right-6 md:w-[22.5rem] md:items-stretch md:px-0',
        timer.status === 'idle' ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(11rem+env(safe-area-inset-bottom))]',
      )}
    >
      <AnimatePresence initial={false}>
        {popups.map((item) => (
          <Popup key={item.id} item={item} onDismiss={() => onDismiss(item.id)} onOpen={() => onOpen(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Popup({ item, onDismiss, onOpen }: { item: AppNotification; onDismiss: () => void; onOpen: () => void }) {
  const timer = useRef<number>();
  const close = useRef(onDismiss);
  close.current = onDismiss;
  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => close.current(), POPUP_MS);
  }, []);
  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, [start]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={start}
      className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-line-strong bg-ink-800 shadow-pop md:max-w-none"
      role="status"
    >
      <Link to={notificationHref(item)} onClick={onOpen} className="flex gap-3 p-3.5 pr-10 hover:bg-ink-700/60">
        <NotificationAvatar item={item} />
        <span className="min-w-0">
          <span className="block text-sm leading-snug text-fg">
            <span className="font-semibold">{item.actor.name}</span> {KIND[item.kind].text}
          </span>
          {item.preview && <span className="mt-0.5 line-clamp-2 block break-words text-[13px] leading-snug text-fg-muted">{item.preview}</span>}
        </span>
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-ink-600 hover:text-fg"
        aria-label="Dismiss notification"
      >
        <X className="size-4" aria-hidden />
      </button>
    </motion.div>
  );
}

/** The count on the bell. Renders nothing when everything has been read. */
export function UnreadBadge({ className }: { className?: string }) {
  const { unread } = useNotifications();
  if (unread === 0) return null;
  return (
    <span className={cn('flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white tabular', className)}>
      <span className="sr-only">Unread: </span>
      {unread > 99 ? '99+' : unread}
    </span>
  );
}
