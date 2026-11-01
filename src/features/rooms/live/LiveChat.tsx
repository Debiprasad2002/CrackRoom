import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, SendHorizontal } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { fmt } from '@/lib/date';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { roomsService } from '@/services/roomsService';
import { errorMessage } from '@/services/http';

const POLL_MS = 5000;
const KEEP = 200;

function merge(list: ChatMessage[], incoming: ChatMessage[]) {
  const seen = new Set(list.map((m) => String(m.id)));
  const fresh = incoming.filter((m) => !seen.has(String(m.id)));
  return fresh.length ? [...list, ...fresh].slice(-KEEP) : list;
}

/** Messages for one room. History comes over HTTP; new ones arrive by socket, or by polling while it is down. */
export function useRoomMessages(roomId: string, socketLive: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const lastId = useRef<string | number | undefined>(undefined);
  lastId.current = messages.at(-1)?.id;

  const append = useCallback((incoming: ChatMessage[]) => setMessages((list) => merge(list, incoming)), []);

  useEffect(() => {
    let cancelled = false;
    roomsService.messages(roomId).then(
      (list) => {
        if (cancelled) return;
        append(list);
        setLoaded(true);
      },
      () => !cancelled && setLoaded(true),
    );
    return () => {
      cancelled = true;
    };
  }, [roomId, append]);

  // Catch up whenever the socket is not carrying messages, including the gap during a reconnect.
  useEffect(() => {
    if (!loaded || socketLive) return;
    const id = window.setInterval(() => {
      roomsService.messages(roomId, lastId.current).then(append, () => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [roomId, loaded, socketLive, append]);

  // After a reconnect, fetch anything sent while the socket was down.
  useEffect(() => {
    if (loaded && socketLive && lastId.current != null) {
      roomsService.messages(roomId, lastId.current).then(append, () => undefined);
    }
  }, [roomId, loaded, socketLive, append]);

  return { messages, loaded, append };
}

interface LiveChatProps {
  roomId: string;
  you: string | null;
  messages: ChatMessage[];
  loaded: boolean;
  append: (messages: ChatMessage[]) => void;
  /** Silent rooms close chat while a shared focus block is running. */
  locked: boolean;
}

export function LiveChat({ roomId, you, messages, loaded, append, locked }: LiveChatProps) {
  const notify = useToast();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || locked || sending) return;
    setSending(true);
    try {
      append([await roomsService.sendMessage(roomId, body)]);
      setDraft('');
    } catch (error) {
      notify({ tone: 'error', title: 'Message not sent', description: errorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-sans text-sm font-semibold">Room chat</h2>
        <span className="text-xs text-fg-subtle">{locked ? 'Closed during focus' : 'Visible to room members'}</span>
      </div>
      <ol ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-label="Messages" aria-live="polite">
        {!loaded ? (
          <li className="space-y-3" aria-busy="true">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-10 w-2/3" />
          </li>
        ) : messages.length === 0 ? (
          <li>
            <EmptyState className="py-6" icon={<MessageSquare />} title="No messages yet" description="Say hello, or share what you're working on this block." />
          </li>
        ) : (
          messages.map((m) => {
            const own = m.isOwn || (you != null && m.authorKey === you);
            return (
              <li key={m.id} className="flex gap-2.5">
                <Avatar name={m.author} hue={m.authorHue ?? undefined} avatar={m.authorAvatar} size="xs" className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-fg-subtle">
                    <span className="font-medium text-fg-muted">{own ? 'You' : m.author}</span> · {fmt.time(m.sentAt)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-fg">{m.body}</p>
                </div>
              </li>
            );
          })
        )}
      </ol>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <label htmlFor={`chat-${roomId}`} className="sr-only">
          Message
        </label>
        <input
          id={`chat-${roomId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={locked}
          maxLength={500}
          autoComplete="off"
          placeholder={locked ? 'Chat opens during breaks' : 'Write a message'}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-ink-850 px-3 text-sm text-fg placeholder:text-fg-subtle focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-400 focus-visible:ring-offset-0 disabled:opacity-60"
        />
        <Button type="submit" size="icon" disabled={locked || sending || !draft.trim()} aria-label="Send message">
          <SendHorizontal aria-hidden />
        </Button>
      </form>
    </div>
  );
}
