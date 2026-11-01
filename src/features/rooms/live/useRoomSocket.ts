import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, PresenceStatus, RoomPerson, RoomTimer } from '@/types';
import { roomsService } from '@/services/roomsService';

/**
 * connecting: first attempt. live: socket open. reconnecting: dropped, retrying.
 * removed: the student left or lost access. closed: the host closed the room.
 */
export type SocketState = 'connecting' | 'live' | 'reconnecting' | 'removed' | 'closed';

type ServerEvent =
  | { type: 'snapshot'; people: RoomPerson[]; timer: RoomTimer }
  | { type: 'presence'; people: RoomPerson[] }
  | { type: 'timer'; timer: RoomTimer }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'closed' }
  | { type: 'pong' };

interface Options {
  enabled: boolean;
  onTimer: (timer: RoomTimer) => void;
  onChat: (message: ChatMessage) => void;
}

const PING_MS = 25_000;
const BACKOFF_MS = [1000, 2000, 5000, 10_000, 15_000];

function socketUrl(url: string, ticket: string) {
  const base = /^wss?:\/\//.test(url) ? url : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${url}`;
  return `${base}?ticket=${encodeURIComponent(ticket)}`;
}

/** The live feed for one room: presence, timer changes and chat pushed by the server. */
export function useRoomSocket(roomId: string, { enabled, onTimer, onChat }: Options) {
  const [state, setState] = useState<SocketState>('connecting');
  const [people, setPeople] = useState<RoomPerson[]>([]);
  const [you, setYou] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<PresenceStatus>('ready');
  const handlers = useRef({ onTimer, onChat });
  handlers.current = { onTimer, onChat };

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    const scheduleRetry = () => {
      if (stopped) return;
      setState('reconnecting');
      retryTimer = window.setTimeout(connect, BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]);
    };

    async function connect() {
      let ticket;
      try {
        ticket = await roomsService.socketTicket(roomId);
      } catch (e) {
        if ((e as { status?: number }).status === 403) setState('removed');
        else scheduleRetry();
        return;
      }
      if (stopped) return;
      setYou(ticket.you);
      const ws = new WebSocket(socketUrl(ticket.url, ticket.ticket));
      socketRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        pingTimer = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping' })), PING_MS);
      };
      ws.onmessage = (event) => {
        let data: ServerEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === 'snapshot') {
          setPeople(data.people);
          handlers.current.onTimer(data.timer);
          setState('live');
          // Restore this tab's status after a reconnect.
          if (statusRef.current !== 'ready') ws.send(JSON.stringify({ type: 'status', status: statusRef.current }));
        } else if (data.type === 'presence') setPeople(data.people);
        else if (data.type === 'timer') handlers.current.onTimer(data.timer);
        else if (data.type === 'chat') handlers.current.onChat(data.message);
        else if (data.type === 'closed') setState('closed');
      };
      ws.onclose = (event) => {
        window.clearInterval(pingTimer);
        if (socketRef.current === ws) socketRef.current = null;
        if (stopped) return;
        if (event.code === 4403) setState('removed');
        else if (event.code === 4404) setState('closed');
        else scheduleRetry(); // includes 4401: the ticket expired; a fresh one is fetched.
      };
    }

    setState('connecting');
    void connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      socketRef.current?.close(1000);
      socketRef.current = null;
    };
  }, [roomId, enabled]);

  const sendStatus = useCallback((status: PresenceStatus) => {
    if (statusRef.current === status) return;
    statusRef.current = status;
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'status', status }));
  }, []);

  return { state, people, you, sendStatus };
}
