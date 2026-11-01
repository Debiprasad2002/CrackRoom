import type { Exam, Level, StudyMode, Subject } from '@/types';

export const EXAMS: { value: Exam; label: string; description: string }[] = [
  { value: 'JEE', label: 'JEE', description: 'Main and Advanced — engineering entrance' },
  { value: 'NEET', label: 'NEET', description: 'NEET UG — medical entrance' },
];

export const LEVELS: { value: Level; label: string; description: string }[] = [
  { value: 'class11', label: 'Class 11', description: 'Building the foundation' },
  { value: 'class12', label: 'Class 12', description: 'Boards and entrance together' },
  { value: 'dropper', label: 'Dropper', description: 'A full year focused on the exam' },
  { value: 'other', label: 'Other', description: 'Repeating, part-time or just exploring' },
];

/** `color` is the chart/mark colour; `tile` styles an icon tile. Text never takes the subject colour. */
export const SUBJECTS: Record<Subject, { label: string; short: string; color: string; dot: string; tile: string }> = {
  physics: { label: 'Physics', short: 'Phy', color: '#169CB8', dot: 'bg-subj-phy', tile: 'border-subj-phy/30 bg-subj-phy/10 text-[#0E7490]' },
  chemistry: { label: 'Chemistry', short: 'Chem', color: '#C4861A', dot: 'bg-subj-chem', tile: 'border-subj-chem/30 bg-subj-chem/10 text-[#92400E]' },
  mathematics: { label: 'Mathematics', short: 'Maths', color: '#8B5CF6', dot: 'bg-subj-math', tile: 'border-subj-math/35 bg-subj-math/10 text-violet-300' },
  biology: { label: 'Biology', short: 'Bio', color: '#D9608F', dot: 'bg-subj-bio', tile: 'border-subj-bio/30 bg-subj-bio/10 text-[#BE185D]' },
};

export const MIXED_TILE = 'border-line-strong bg-ink-700 text-fg-muted';

export const SUBJECTS_BY_EXAM: Record<Exam, Subject[]> = {
  JEE: ['physics', 'chemistry', 'mathematics'],
  NEET: ['physics', 'chemistry', 'biology'],
};

export const MODES: Record<StudyMode, { label: string; description: string }> = {
  pomodoro: { label: 'Pomodoro', description: 'Timed focus blocks with short breaks' },
  silent: { label: 'Silent co-study', description: 'Cameras optional, no chat during focus' },
  doubt: { label: 'Doubt solving', description: 'Work problems, ask during breaks' },
  revision: { label: 'Revision sprint', description: 'Fast recall and formula review' },
};

export const CHAPTERS: Record<Subject, string[]> = {
  physics: [
    'Units and Measurement', 'Kinematics', 'Laws of Motion', 'Work, Energy and Power',
    'Rotational Motion', 'Gravitation', 'Thermodynamics', 'Oscillations and Waves',
    'Electrostatics', 'Current Electricity', 'Magnetism', 'Electromagnetic Induction',
    'Ray and Wave Optics', 'Modern Physics',
  ],
  chemistry: [
    'Mole Concept', 'Atomic Structure', 'Chemical Bonding', 'Chemical Thermodynamics',
    'Equilibrium', 'Electrochemistry', 'Chemical Kinetics', 'General Organic Chemistry',
    'Hydrocarbons', 'Coordination Compounds', 'p-Block Elements', 'Biomolecules',
  ],
  mathematics: [
    'Sets and Functions', 'Trigonometry', 'Complex Numbers', 'Quadratic Equations',
    'Sequences and Series', 'Permutations and Combinations', 'Binomial Theorem',
    'Straight Lines', 'Conic Sections', 'Limits and Continuity', 'Differentiation',
    'Integration', 'Differential Equations', 'Vectors and 3D Geometry', 'Probability',
    'Matrices and Determinants',
  ],
  biology: [
    'Diversity of the Living World', 'Cell: Structure and Function', 'Plant Physiology',
    'Human Physiology', 'Reproduction', 'Genetics and Evolution', 'Biology in Human Welfare',
    'Biotechnology', 'Ecology and Environment',
  ],
};

export function levelLabel(level: Level | 'all') {
  return level === 'all' ? 'All classes' : LEVELS.find((l) => l.value === level)?.label ?? level;
}

export function examLabel(exam: Exam | 'both') {
  return exam === 'both' ? 'JEE + NEET' : exam;
}

/** JEE and NEET are written in the first half of the year, so after June the next attempt is next year. */
export function upcomingExamYears(now = new Date()) {
  const first = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
  return [first, first + 1, first + 2, first + 3];
}
