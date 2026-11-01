import {
  Atom,
  BookOpen,
  Brain,
  Compass,
  Dna,
  FlaskConical,
  Flame,
  Leaf,
  Microscope,
  Moon,
  Rocket,
  Sigma,
  Sparkles,
  Sun,
  Telescope,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Preset profile pictures. Keys match AVATAR_KEYS on the server. */
export type AvatarPreset =
  | { key: string; label: string; kind: 'illustration'; image: string }
  | { key: string; label: string; kind: 'icon'; icon: LucideIcon; from: string; to: string };

/** Hand-illustrated students, served from public/avatars/. */
export const ILLUSTRATED: AvatarPreset[] = [
  { key: 'focused', label: 'Focused', kind: 'illustration', image: '/avatars/focused.webp' },
  { key: 'bookworm', label: 'Bookworm', kind: 'illustration', image: '/avatars/bookworm.webp' },
  { key: 'backpacker', label: 'Backpacker', kind: 'illustration', image: '/avatars/backpacker.webp' },
  { key: 'topper', label: 'Topper', kind: 'illustration', image: '/avatars/topper.webp' },
];

export const ICON_AVATARS: AvatarPreset[] = (
  [
  { key: 'atom', label: 'Atom', icon: Atom, from: '#22D3EE', to: '#2563EB' },
  { key: 'flask', label: 'Flask', icon: FlaskConical, from: '#FBBF24', to: '#EA580C' },
  { key: 'dna', label: 'DNA', icon: Dna, from: '#F472B6', to: '#BE185D' },
  { key: 'sigma', label: 'Sigma', icon: Sigma, from: '#A78BFA', to: '#6D28D9' },
  { key: 'rocket', label: 'Rocket', icon: Rocket, from: '#FB7185', to: '#7C3AED' },
  { key: 'brain', label: 'Brain', icon: Brain, from: '#F0ABFC', to: '#A21CAF' },
  { key: 'microscope', label: 'Microscope', icon: Microscope, from: '#5EEAD4', to: '#0F766E' },
  { key: 'telescope', label: 'Telescope', icon: Telescope, from: '#818CF8', to: '#1E1B4B' },
  { key: 'leaf', label: 'Leaf', icon: Leaf, from: '#86EFAC', to: '#15803D' },
  { key: 'zap', label: 'Spark', icon: Zap, from: '#FDE047', to: '#CA8A04' },
  { key: 'compass', label: 'Compass', icon: Compass, from: '#7DD3FC', to: '#0369A1' },
  { key: 'book', label: 'Book', icon: BookOpen, from: '#FDBA74', to: '#C2410C' },
  { key: 'flame', label: 'Flame', icon: Flame, from: '#FCA5A5', to: '#DC2626' },
  { key: 'moon', label: 'Night owl', icon: Moon, from: '#C4B5FD', to: '#312E81' },
  { key: 'sun', label: 'Early bird', icon: Sun, from: '#FEF08A', to: '#F97316' },
  { key: 'sparkles', label: 'Sparkles', icon: Sparkles, from: '#F9A8D4', to: '#8B5CF6' },
  ] as const
).map((a) => ({ ...a, kind: 'icon' as const }));

export const AVATARS: AvatarPreset[] = [...ILLUSTRATED, ...ICON_AVATARS];

export const AVATAR_BY_KEY: Record<string, AvatarPreset> = Object.fromEntries(AVATARS.map((a) => [a.key, a]));
