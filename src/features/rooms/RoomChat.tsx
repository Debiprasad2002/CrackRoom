import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, SendHorizontal } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { fmt } from '@/lib/date';
import { readJSON, uid, writeJSON } from '@/lib/storage';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { useRequiredProfile } from '@/features/profile/ProfileContext';

interface RoomChatProps {
  roomId: string;
  /** Silent rooms close chat while a focus block is running. */
  locked: boolean;
}

/**
 * Chat UI shaped for a future WebSocket feed. Today messages are kept on this device only
 * and are never sent anywhere, which the panel states plainly.
 */
export function RoomChat({ roomId, locked }: RoomChatProps) {
  const { profile } = useRequiredProfile();
  const key = `chat.${roomId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => readJSON<ChatMessage[]>(key, []));
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || locked) return;
    const next = [...messages, { id: uid(), roomId, author: profile.displayName, body, sentAt: new Date().toISOString() }].slice(-100);
    setMessages(next);
    writeJSON(key, next);
    setDraft('');
  }

  return (
    <div className="flex h-[26rem] flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-sans text-sm font-semibold">Room chat</h2>
        <span className="text-xs text-fg-subtle">On this device only</span>
      </div>
      <ol ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-label="Messages" aria-live="polite">
        {messages.length === 0 ? (
          <li>
            <EmptyState
              className="py-6"
              icon={<MessageSquare />}
              title="No messages yet"
              description="Messages will reach other students once live rooms are connected. For now they stay in your browser."
            />
          </li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className="flex gap-2.5">
              <Avatar name={m.author} hue={profile.avatarHue} avatar={profile.avatar} size="xs" className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-fg-subtle">
                  <span className="font-medium text-fg-muted">You</span> · {fmt.time(m.sentAt)}
                </p>
                <p className="mt-0.5 break-words text-sm text-fg">{m.body}</p>
              </div>
            </li>
          ))
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
        <Button type="submit" size="icon" disabled={locked || !draft.trim()} aria-label="Send message">
          <SendHorizontal aria-hidden />
        </Button>
      </form>
    </div>
  );
}
