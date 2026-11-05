import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bell, BookOpen, CalendarCheck, DoorOpen, GraduationCap, House, MessagesSquare, Timer, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { useRequiredProfile } from '@/features/profile/ProfileContext';
import { TimerDocumentTitle, TimerPill } from '@/features/focus/TimerPill';
import { FloatingTimer } from '@/features/focus/FloatingTimer';
import { levelLabel } from '@/data/catalog';
import { Card } from '@/components/ui/Layout';
import { ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useFocus } from '@/features/focus/FocusContext';
import { usePlanner } from '@/features/planner/PlannerContext';
import { LocalImportPrompt } from '@/features/sync/LocalImportPrompt';
import { UnreadBadge } from '@/features/notifications/NotificationsContext';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', short: 'Home', icon: House, end: true },
  { to: '/rooms', label: 'Live Rooms', short: 'Rooms', icon: DoorOpen },
  { to: '/notes', label: 'Notes Library', short: 'Notes', icon: BookOpen },
  { to: '/planner', label: 'Study Planner', short: 'Planner', icon: CalendarCheck },
  { to: '/community', label: 'Community', short: 'Community', icon: MessagesSquare },
];

const FOCUS: NavItem = { to: '/focus', label: 'Focus Timer', short: 'Focus', icon: Timer };
const MENTORSHIP: NavItem = { to: '/mentorship', label: 'Mentorship', short: 'Mentors', icon: GraduationCap };
const NOTIFICATIONS: NavItem = { to: '/notifications', label: 'Notifications', short: 'Alerts', icon: Bell };

/*
 * Three navigation layouts, one set of destinations:
 *   phones  (< 768px)        top bar + floating bottom dock
 *   tablets (768–1279px)     slim icon rail, so iPads in either orientation keep the full width
 *   desktop (>= 1280px)      full sidebar with labels and the profile card
 */

function SidebarLink({ item, badge }: { item: NavItem; badge?: ReactNode }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          isActive ? 'bg-ink-700 text-fg' : 'text-fg-muted hover:bg-ink-700/60 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="sidebar-active" className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-full bg-violet-400" aria-hidden />
          )}
          <Icon className={cn('size-[18px]', isActive ? 'text-violet-300' : 'text-fg-subtle group-hover:text-fg-muted')} aria-hidden />
          {item.label}
          {badge && <span className="ml-auto">{badge}</span>}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const { profile } = useRequiredProfile();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-ink-850 xl:flex">
      <div className="flex h-16 items-center px-6">
        <Link to="/" className="rounded-lg" aria-label="CrackRoom home">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {NAV.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
        <div className="my-3 h-px bg-line" aria-hidden />
        <SidebarLink item={FOCUS} />
        <SidebarLink item={MENTORSHIP} />
        <SidebarLink item={NOTIFICATIONS} badge={<UnreadBadge />} />
        <div className="mt-2 px-3">
          <TimerPill className="w-full justify-center" hideWhenIdle />
        </div>
      </nav>
      <div className="border-t border-line p-3">
        <ThemeToggle withLabel className="mb-1 h-10 w-full rounded-xl px-3 text-sm font-medium hover:bg-ink-700/60" />
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-xl p-2 transition-colors', isActive ? 'bg-ink-700' : 'hover:bg-ink-700/60')
          }
        >
          <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg">{profile.displayName}</span>
            <span className="block truncate text-xs text-fg-subtle">
              {profile.exam} {profile.targetYear} · {levelLabel(profile.level)}
            </span>
          </span>
        </NavLink>
      </div>
    </aside>
  );
}

function RailLink({ item, badge }: { item: NavItem; badge?: ReactNode }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        cn('group flex w-full flex-col items-center gap-1 py-1.5 text-[11px] font-medium', isActive ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted')
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative flex h-9 w-14 items-center justify-center">
            {isActive && (
              <motion.span
                layoutId="rail-active"
                className="absolute inset-0 rounded-2xl bg-violet-500/[0.12]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                aria-hidden
              />
            )}
            <Icon className={cn('relative size-5', isActive ? 'text-violet-300' : 'group-hover:text-fg-muted')} aria-hidden />
            {badge && <span className="absolute -top-1 right-1.5">{badge}</span>}
          </span>
          {item.short}
        </>
      )}
    </NavLink>
  );
}

function Rail() {
  const { profile } = useRequiredProfile();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[5.5rem] flex-col items-center border-r border-line bg-ink-850 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:flex xl:hidden">
      <Link to="/" className="rounded-xl p-1" aria-label="CrackRoom home">
        <LogoMark size={36} />
      </Link>
      <nav aria-label="Main" className="mt-6 flex w-full flex-1 flex-col items-center gap-2 px-2">
        {NAV.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
        <div className="my-1 h-px w-10 bg-line" aria-hidden />
        <RailLink item={FOCUS} />
        <RailLink item={MENTORSHIP} />
        <RailLink item={NOTIFICATIONS} badge={<UnreadBadge />} />
        <TimerPill className="mt-1 h-8 px-2 text-xs" hideWhenIdle />
      </nav>
      <ThemeToggle className="mb-2 size-10 justify-center rounded-xl hover:bg-ink-700/60" />
      <NavLink
        to="/profile"
        title="Profile and settings"
        aria-label="Your profile and settings"
        className={({ isActive }) => cn('rounded-full p-1 ring-2 transition-colors', isActive ? 'ring-violet-400' : 'ring-transparent hover:ring-line-strong')}
      >
        <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="sm" />
      </NavLink>
    </aside>
  );
}

function MobileTopBar() {
  const { profile } = useRequiredProfile();
  const { timer } = useFocus();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink-900/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-3 min-[380px]:gap-3 min-[380px]:px-4">
        <Link to="/" className="-my-1 min-w-0 rounded-lg py-2" aria-label="CrackRoom home">
          {/* The name gives way on narrow phones, and to a running timer's wider pill, so every control stays on one line. */}
          <Logo size="sm" textClassName={timer.status === 'idle' ? 'max-[379px]:sr-only' : 'max-[479px]:sr-only'} />
        </Link>
        <div className="flex shrink-0 items-center gap-0.5 min-[380px]:gap-1">
          <TimerPill />
          <ThemeToggle className="size-10 justify-center rounded-xl hover:bg-ink-700" />
          <Link to="/notifications" className="relative inline-flex size-10 items-center justify-center rounded-xl text-fg-muted hover:bg-ink-700 hover:text-fg" aria-label="Notifications">
            <Bell className="size-5" aria-hidden />
            <UnreadBadge className="absolute right-0 top-0" />
          </Link>
          <Link to="/mentorship" className="inline-flex size-10 items-center justify-center rounded-xl text-fg-muted hover:bg-ink-700 hover:text-fg" aria-label="Mentorship">
            <GraduationCap className="size-5" aria-hidden />
          </Link>
          <Link to="/profile" className="rounded-full p-1" aria-label="Your profile and settings">
            <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** A floating dock that sits above the home indicator, with a sliding highlight on the active tab. */
function MobileDock() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 rounded-[1.375rem] border border-line bg-ink-800/90 px-1.5 shadow-pop backdrop-blur-xl">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-violet-300' : 'text-fg-subtle active:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="dock-active"
                        className="absolute inset-x-1 inset-y-1.5 rounded-2xl bg-violet-500/10"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                        aria-hidden
                      />
                    )}
                    <Icon className="relative size-5" strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                    <span className="relative">{item.short}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Pages render once the student's sessions and plans have loaded from the server. */
function SyncedOutlet() {
  const focus = useFocus();
  const planner = usePlanner();
  if (focus.status === 'error' || planner.status === 'error') {
    return (
      <Card>
        <ErrorState
          message="Your study history could not be loaded. Check your connection and try again."
          onRetry={() => {
            if (focus.status === 'error') focus.reload();
            if (planner.status === 'error') planner.reload();
          }}
        />
      </Card>
    );
  }
  if (focus.status === 'loading' || planner.status === 'loading') return <PageSkeleton />;
  return (
    <>
      <LocalImportPrompt />
      <Outlet />
    </>
  );
}

export function AppShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-violet-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <TimerDocumentTitle />
      <Sidebar />
      <Rail />
      <MobileTopBar />
      <div className="md:pl-[5.5rem] xl:pl-64">
        {/* One restrained light source at the top of the canvas. */}
        <div
          className="pointer-events-none fixed inset-x-0 top-0 h-80 md:left-[5.5rem] xl:left-64"
          style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(124,58,237,0.07), transparent 70%)' }}
          aria-hidden
        />
        <main
          id="main"
          tabIndex={-1}
          className="relative mx-auto w-full max-w-6xl px-4 pb-32 pt-5 outline-none sm:px-6 md:px-8 md:pb-12 md:pt-8 xl:px-10 xl:pt-10"
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <ErrorBoundary key={pathname}>
              <SyncedOutlet />
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>
      <FloatingTimer />
      <MobileDock />
    </div>
  );
}
