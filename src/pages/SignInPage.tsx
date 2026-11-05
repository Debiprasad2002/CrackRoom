import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { errorMessage } from '@/services/http';
import { useAuth } from '@/features/auth/AuthContext';
import { AuthLayout, FormAlert } from '@/features/auth/AuthLayout';
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton';
import { safeNext } from '@/features/auth/redirect';

export default function SignInPage() {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleCredential(credential: string) {
    setBusy(true);
    setFailure(undefined);
    try {
      await signInWithGoogle(credential);
      // New students go on to onboarding; the router sends them there until a profile exists.
      navigate(safeNext(search), { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome to CrackRoom"
      description="Sign in with your Google account to join rooms, sync your focus history and pick up your streak on any device."
      footer={
        <p className="flex gap-2.5 text-[13px] leading-relaxed">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint-400" aria-hidden />
          <span>
            We only receive your name, email and Google account id. Your email is never shown to other students, and
            there is no password to remember. <a href="/privacy" className="font-medium text-violet-300 underline">Privacy Policy</a>
          </span>
        </p>
      }
    >
      <div className="space-y-4">
        {failure && <FormAlert>{failure}</FormAlert>}
        <GoogleSignInButton onCredential={handleCredential} onError={setFailure} disabled={busy} />
        <p className="text-center text-xs text-fg-subtle" aria-live="polite">
          {busy ? 'Signing you in…' : 'New here? The same button creates your account.'}
        </p>
      </div>
    </AuthLayout>
  );
}
