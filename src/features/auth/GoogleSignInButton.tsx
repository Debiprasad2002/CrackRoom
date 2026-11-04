import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '@/services/config';
import { Skeleton } from '@/components/ui/Feedback';

/** Minimal typing for the parts of Google Identity Services this app uses. */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            context?: 'signin' | 'signup' | 'use';
            itp_support?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google sign-in could not load. Check your connection, or turn off blockers for this site.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/** Google's own button, rendered by Google so it matches their branding rules. */
export function GoogleSignInButton({ onCredential, onError, disabled }: GoogleSignInButtonProps) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      handlers.current.onError('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.');
      return;
    }
    let cancelled = false;
    loadGoogleScript().then(
      () => {
        if (cancelled || !host.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => handlers.current.onCredential(credential),
          ux_mode: 'popup',
          context: 'signin',
          itp_support: true,
        });
        window.google.accounts.id.renderButton(host.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.min(400, host.current.clientWidth || 320),
        });
        setReady(true);
      },
      (e: Error) => !cancelled && handlers.current.onError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined} aria-busy={!ready}>
      {!ready && <Skeleton className="h-11 w-full rounded-full" />}
      {/* Google's button is an iframe, which shows a white box behind it under a dark color-scheme. */}
      <div ref={host} className="flex min-h-11 w-full justify-center [color-scheme:light]" />
    </div>
  );
}
