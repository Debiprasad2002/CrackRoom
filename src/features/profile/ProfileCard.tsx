import type { Profile } from '@/types';
import { SUBJECTS, levelLabel } from '@/data/catalog';
import { cn } from '@/lib/cn';
import { formatMinutes } from '@/lib/date';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface ProfileCardProps {
  profile: Profile;
  stats: { streak: number; minutes: number; sessions: number };
  /** Render only what the student's privacy settings allow others to see. */
  publicView?: boolean;
}

export function ProfileCard({ profile, stats, publicView = false }: ProfileCardProps) {
  const show = {
    year: !publicView || profile.privacy.showTargetYear,
    subjects: !publicView || profile.privacy.showSubjects,
    stats: !publicView || profile.privacy.showStats,
  };
  return (
    <div className={cn('flex flex-col', publicView ? 'gap-4' : 'gap-5 sm:flex-row sm:items-center')}>
      <div className={cn('flex min-w-0 items-center gap-4', !publicView && 'flex-1 sm:gap-5')}>
        <Avatar name={profile.displayName} hue={profile.avatarHue} avatar={profile.avatar} size={publicView ? 'lg' : 'xl'} />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-display font-semibold text-fg', publicView ? 'text-lg' : 'text-2xl')}>{profile.displayName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="violet">
              {profile.exam}
              {show.year ? ` ${profile.targetYear}` : ''}
            </Badge>
            <Badge>{levelLabel(profile.level)}</Badge>
            {show.subjects &&
              profile.subjects.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-fg-muted">
                  <span className={cn('size-1.5 rounded-full', SUBJECTS[s].dot)} aria-hidden />
                  {SUBJECTS[s].label}
                </span>
              ))}
          </div>
        </div>
      </div>
      {show.stats && (
        <dl
          className={cn(
            'grid grid-cols-3 gap-4 border-t border-line pt-4',
            !publicView && 'sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0',
          )}
        >
          <div>
            <dt className="text-xs text-fg-subtle">Streak</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular">{stats.streak}d</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Focused</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular">{formatMinutes(stats.minutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Sessions</dt>
            <dd className="mt-0.5 font-semibold text-fg tabular">{stats.sessions}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
