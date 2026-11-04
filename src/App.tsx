import { lazy, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { CloudOff } from 'lucide-react';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { ProfileProvider, useProfile } from '@/features/profile/ProfileContext';
import { PlannerProvider } from '@/features/planner/PlannerContext';
import { FocusProvider } from '@/features/focus/FocusContext';
import { NotificationsProvider } from '@/features/notifications/NotificationsContext';
import { AppShell } from '@/layouts/AppShell';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { PageSkeleton as PageFallback } from '@/components/ui/Feedback';
import { USING_SAMPLE_DATA } from '@/services/config';

const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const SignInPage = lazy(() => import('@/pages/SignInPage'));
const HomePage = lazy(() => import('@/pages/HomePage'));
const RoomsPage = lazy(() => import('@/pages/RoomsPage'));
const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage'));
const NotesPage = lazy(() => import('@/pages/NotesPage'));
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage'));
const PlannerPage = lazy(() => import('@/pages/PlannerPage'));
const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
const FocusPage = lazy(() => import('@/pages/FocusPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const MentorshipPage = lazy(() => import('@/pages/MentorshipPage'));
const CommunityPage = lazy(() => import('@/pages/CommunityPage'));
const PostPage = lazy(() => import('@/pages/CommunityPage').then((m) => ({ default: m.PostPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const MentorProfilePage = lazy(() => import('@/pages/MentorProfilePage'));
const MentorSchedulePage = lazy(() => import('@/pages/MentorSchedulePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/* index.html holds the public homepage as real HTML, so search engines can read it and it opens
   instantly even while the free server is asleep. It stays hidden while `app-route` is on <html>;
   the script in index.html sets that up before the first paint, using this same key. */
const SESSION_HINT = 'crackroom-signed-in';

function hadSession() {
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return false;
  }
}

function rememberSession(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    /* Without storage, a signed-in student just sees the homepage briefly on the way in. */
  }
}

// The device-only prototype has no accounts, so it goes straight into the app.
if (USING_SAMPLE_DATA) document.documentElement.classList.add('app-route');

/** Shows the homepage from index.html for as long as this is mounted. */
function GuestHomepage() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('app-route');
    return () => root.classList.add('app-route');
  }, []);
  return null;
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6" aria-busy="true" aria-label="Loading CrackRoom">
      <Logo size="lg" />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full w-1/3 animate-shimmer rounded-full bg-violet-400/70" />
      </div>
    </div>
  );
}

function ServerUnreachable() {
  const { error, retry } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <span className="mt-10 flex size-12 items-center justify-center rounded-2xl border border-line-strong bg-ink-700 text-fg-muted">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold">Can't reach CrackRoom right now</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">{error}</p>
      <p className="mt-1 max-w-sm text-xs text-fg-subtle">If nobody has visited for a while, the server can take up to a minute to wake.</p>
      <Button className="mt-6" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

/** Signed-in students only. In local mode there are no accounts, so everyone passes. */
function RequireAccount() {
  const { status } = useAuth();
  const location = useLocation();
  useEffect(() => {
    if (status === 'signedIn') rememberSession(true);
    if (status === 'signedOut') rememberSession(false);
  }, [status]);
  const guestAtHome = location.pathname === '/' && (status === 'signedOut' || ((status === 'loading' || status === 'unreachable') && !hadSession()));
  if (guestAtHome) return <GuestHomepage />;
  if (status === 'loading') return <Splash />;
  if (status === 'unreachable') return <ServerUnreachable />;
  if (status === 'signedOut') {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'unreachable') return <ServerUnreachable />;
  if (status === 'signedIn') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  return profile ? <>{children}</> : <Navigate to="/welcome" replace />;
}

function OnboardingRoute() {
  const { profile } = useProfile();
  return profile ? <Navigate to="/" replace /> : <OnboardingPage />;
}

/** Study data belongs to one account; remounting on account change drops the previous student's state. */
function StudyProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <PlannerProvider key={user?.email ?? 'local'}>
      <FocusProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </FocusProvider>
    </PlannerProvider>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ProfileProvider>
              <Suspense fallback={<Splash />}>
                <Routes>
                  {!USING_SAMPLE_DATA && (
                    <>
                      <Route path="/signin" element={<GuestOnly><SignInPage /></GuestOnly>} />
                      {/* Sign-up and password pages were replaced by Google sign-in; keep old links working. */}
                      <Route path="/signup" element={<Navigate to="/signin" replace />} />
                      <Route path="/forgot-password" element={<Navigate to="/signin" replace />} />
                    </>
                  )}
                  <Route element={<RequireAccount />}>
                    <Route path="/welcome" element={<OnboardingRoute />} />
                    <Route
                      element={
                        <RequireProfile>
                          <StudyProviders>
                            <AppShell />
                          </StudyProviders>
                        </RequireProfile>
                      }
                    >
                      <Route index element={<Lazy><HomePage /></Lazy>} />
                      <Route path="rooms" element={<Lazy><RoomsPage /></Lazy>} />
                      <Route path="rooms/:roomId" element={<Lazy><RoomDetailPage /></Lazy>} />
                      <Route path="notes" element={<Lazy><NotesPage /></Lazy>} />
                      <Route path="notes/:resourceId" element={<Lazy><NoteDetailPage /></Lazy>} />
                      <Route path="planner" element={<Lazy><PlannerPage /></Lazy>} />
                      <Route path="progress" element={<Lazy><ProgressPage /></Lazy>} />
                      <Route path="focus" element={<Lazy><FocusPage /></Lazy>} />
                      <Route path="community" element={<Lazy><CommunityPage /></Lazy>} />
                      <Route path="community/posts/:postId" element={<Lazy><PostPage /></Lazy>} />
                      <Route path="notifications" element={<Lazy><NotificationsPage /></Lazy>} />
                      <Route path="mentorship" element={<Lazy><MentorshipPage /></Lazy>} />
                      <Route path="mentorship/schedule" element={<Lazy><MentorSchedulePage /></Lazy>} />
                      <Route path="mentorship/:mentorId" element={<Lazy><MentorProfilePage /></Lazy>} />
                      <Route path="profile" element={<Lazy><ProfilePage /></Lazy>} />
                      <Route path="*" element={<Lazy><NotFoundPage /></Lazy>} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </ProfileProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}

/** Keeps the shell on screen while a page chunk loads. */
function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}
