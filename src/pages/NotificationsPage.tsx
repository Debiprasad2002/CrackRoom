import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/services/http';
import { USING_SAMPLE_DATA } from '@/services/config';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Layout';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { KIND, NotificationAvatar, notificationHref, useNotifications } from '@/features/notifications/NotificationsContext';
import { timeAgo } from '@/features/community/PostCard';

export default function NotificationsPage() {
  const { items, unread, status, next, reload, loadMore, markRead, markAllRead } = useNotifications();
  const notify = useToast();
  const [loadingMore, setLoadingMore] = useState(false);

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action();
    } catch (e) {
      notify({ tone: 'error', title: failure, description: errorMessage(e) });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Replies, reactions and reshares from other students, and your mentorship sessions."
        actions={
          unread > 0 ? (
            <Button variant="secondary" onClick={() => run(markAllRead, 'Could not mark as read')}>
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {status === 'error' ? (
        <Card>
          <ErrorState message="Your notifications could not be loaded." onRetry={reload} />
        </Card>
      ) : status === 'loading' ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell />}
            title="Nothing yet"
            description={USING_SAMPLE_DATA ? 'Notifications need the CrackRoom server.' : 'When someone replies to you or reacts to your post, you will see it here.'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={notificationHref(item)}
                  onClick={() => !item.read && markRead(item.id)}
                  className={cn('flex gap-3 p-4 transition-colors hover:bg-ink-700/60 sm:px-5', !item.read && 'bg-violet-500/[0.08]')}
                >
                  <NotificationAvatar item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-fg">
                      <span className="font-semibold">{item.actor.name}</span> {KIND[item.kind].text}
                    </span>
                    {item.preview && <span className="mt-0.5 line-clamp-2 block break-words text-[13px] leading-snug text-fg-muted">{item.preview}</span>}
                    <time dateTime={item.createdAt} className="mt-1 block text-xs text-fg-subtle">
                      {timeAgo(item.createdAt)}
                    </time>
                  </span>
                  {!item.read && (
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-violet-400">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {next && (
            <div className="border-t border-line p-3 text-center">
              <Button
                variant="ghost"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  await run(loadMore, 'Could not load more');
                  setLoadingMore(false);
                }}
              >
                {loadingMore ? 'Loading…' : 'Show older'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
