export type Exam = 'JEE' | 'NEET';
export type Level = 'class11' | 'class12' | 'dropper' | 'other';
export type Subject = 'physics' | 'chemistry' | 'mathematics' | 'biology';
export type StudyMode = 'pomodoro' | 'silent' | 'doubt' | 'revision';
export type Visibility = 'public' | 'private';
export type Language = 'English' | 'Hindi' | 'Hinglish';
export type ResourceStatus = 'draft' | 'published' | 'archived';

export interface PrivacySettings {
  showStats: boolean;
  showSubjects: boolean;
  showTargetYear: boolean;
}

export interface Profile {
  displayName: string;
  exam: Exam;
  level: Level;
  subjects: Subject[];
  targetYear: number;
  dailyGoalMinutes: number;
  avatarHue: number;
  /** Preset avatar key; empty shows initials. */
  avatar?: string;
  privacy: PrivacySettings;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  exam: Exam | 'both';
  level: Level | 'all';
  subject: Subject | 'mixed';
  mode: StudyMode;
  visibility: Visibility;
  host: string;
  focusMinutes: number;
  breakMinutes: number;
  capacity: number;
  rules: string[];
  /** Only present when the server reports real presence. Never filled from sample data. */
  participants?: number;
  /** Only present when the server confirms a session is running. */
  isLive?: boolean;
  /** Server-only fields; absent on sample rooms. */
  isMember?: boolean;
  isHost?: boolean;
  /** Only ever sent to the host of a private room. */
  inviteCode?: string | null;
  timer?: RoomTimer;
  canControlTimer?: boolean;
}

/** The shared room clock. A running timer cycles focus → break from `anchor`. */
export interface RoomTimer {
  status: 'idle' | 'running' | 'paused';
  phase: 'focus' | 'break';
  focusSeconds: number;
  breakSeconds: number;
  anchor: string | null;
  offsetSeconds: number | null;
  remainingSeconds: number;
  serverTime: string;
}

export type PresenceStatus = 'ready' | 'focusing' | 'break' | 'paused';

export interface RoomPerson {
  key: string;
  name: string;
  hue: number | null;
  avatar?: string;
  status: PresenceStatus;
  isHost: boolean;
}

/** A roommate's card. Null fields are hidden by that student's privacy settings. */
export interface PublicProfile {
  name: string;
  hue: number | null;
  avatar?: string;
  exam: Exam | null;
  level: Level | null;
  targetYear: number | null;
  subjects: Subject[] | null;
  stats: { streak: number; minutes: number; sessions: number } | null;
  isHost: boolean;
}

export interface SessionUser {
  email: string;
  isStaff: boolean;
  /** Set when this account is also a mentor. */
  mentorId: string | null;
  profile: Profile | null;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  exam: Exam | 'both';
  level: Level | 'all';
  subject: Subject;
  chapter: string;
  language: Language;
  fileType: 'PDF';
  pages?: number;
  publishedAt: string;
  source: string;
  status: ResourceStatus;
  /** Null until a real file has been uploaded to protected storage. */
  fileUrl: string | null;
}

export interface FocusSession {
  id: string;
  subject: Subject | null;
  goal: string;
  minutes: number;
  completedAt: string;
  roomId: string | null;
  /** True when the student stopped before the planned duration ended. */
  partial: boolean;
}

export interface PlannedSession {
  id: string;
  date: string; // yyyy-mm-dd, local time
  subject: Subject;
  title: string;
  minutes: number;
  done: boolean;
}

export interface ChatMessage {
  id: string | number;
  roomId: string;
  author: string;
  body: string;
  sentAt: string;
  authorHue?: number | null;
  authorAvatar?: string;
  /** Per-room id of the author, compared with your own key to spot your messages. */
  authorKey?: string;
  isOwn?: boolean;
}

/* ---- Mentorship ---------------------------------------------------------------------- */

export interface MentorCard {
  id: string;
  name: string;
  headline: string;
  exams: Exam[];
  subjects: Subject[];
  languages: Language[];
  sessionMinutes: number;
  hue: number;
  isVerified: boolean;
  /** Real counts only: sessions already held, and free slots in the next three weeks. */
  sessionsDone: number;
  nextSlot: string | null;
  openSlots: number;
}

export interface MentorSlot {
  id: number;
  startsAt: string;
  minutes: number;
}

export interface MentorDetail extends MentorCard {
  bio: string;
  slots: MentorSlot[];
}

export interface MentorBooking {
  id: number;
  status: 'booked' | 'cancelled';
  topic: string;
  startsAt: string;
  minutes: number;
  mentor: { id: string; name: string; headline: string; hue: number; isVerified: boolean };
  /** Only while the booking is active. */
  meetingUrl: string | null;
  canCancel: boolean;
  cancelledBy: '' | 'student' | 'mentor';
  createdAt: string;
}

export interface MentorOwnSlot extends MentorSlot {
  booking: { id: number; studentName: string; studentHue: number | null; studentExam: string | null; topic: string } | null;
}

export interface MentorSelf {
  id: string;
  name: string;
  isVerified: boolean;
  isActive: boolean;
  headline: string;
  bio: string;
  exams: Exam[];
  subjects: Subject[];
  languages: Language[];
  sessionMinutes: number;
  meetingUrl: string;
  slots?: MentorOwnSlot[];
}

/* ---- Community ----------------------------------------------------------------------- */

export type ReactionKind = 'like' | 'fire' | 'idea';

export interface PostAuthor {
  name: string;
  hue: number | null;
  avatar: string;
  exam: Exam | null;
  level: string | null;
  isYou: boolean;
}

export interface CommunityPost {
  id: number;
  body: string;
  author: PostAuthor;
  createdAt: string;
  reactions: Record<ReactionKind, number>;
  myReaction: ReactionKind | null;
  reshareCount: number;
  commentCount: number;
  isReshare: boolean;
  /** The original post inside a reshare; `{ removed: true }` if it was deleted. */
  resharedFrom: { id: number; body: string; author: PostAuthor; createdAt: string } | { removed: true } | null;
  canDelete: boolean;
}

export interface PostComment {
  id: number;
  body: string;
  author: PostAuthor;
  createdAt: string;
  canDelete: boolean;
  parentId: number | null;
  replyToName: string | null;
}

export type NotificationKind = 'reply' | 'comment' | 'reaction' | 'reshare';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  actor: PostAuthor;
  postId: number;
  commentId: number | null;
  preview: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPage {
  results: AppNotification[];
  unread: number;
  next: number | null;
}

export interface FeedPage {
  results: CommunityPost[];
  next: number | null;
}
