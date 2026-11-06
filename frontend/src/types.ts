// Gemeinsame Domänen-Typen (entsprechen den DTOs der API in SprintLog.Api/DTOs).

export type TrackingType = 'WeightReps' | 'DistanceTime' | 'Duration' | 'Cardio';
export type Category = 'Gym' | 'Football';
export type WorkoutType = 'Gym' | 'Football' | 'Hybrid' | 'Match';
export type ProgramGoal = 'Strength' | 'Hypertrophy' | 'Speed' | 'General' | 'Rehab';

export interface Exercise {
  id: number;
  name: string;
  category: Category | string;
  muscleGroup: string | null;
  trackingType: TrackingType;
  isCustom?: boolean;
  /** Unterstützte Maschine (Gravitron): Gewicht = Hilfe, weniger ist besser. */
  isAssisted?: boolean;
  /** Einseitig: Werte gelten pro Seite (Seitstütz, Split Squat). */
  perSide?: boolean;
}

export type ExerciseNoteReason = 'pain' | 'equipment' | 'time' | 'fatigue' | 'other';

/** Notiz zu einer Übung in einer Einheit - oder ausgelassen mit Grund (für die KI und den Verlauf). */
export interface ExerciseNote {
  exerciseId: number;
  note?: string | null;
  skipped?: boolean;
  reason?: ExerciseNoteReason | null;
}

/** Ein Satz - vom Server (WorkoutSetResponse) oder lokal (laufende Session / Queue). */
export interface WorkoutSet {
  exerciseId?: number | null;
  exerciseName?: string;
  /** v2-Altdaten: Name statt exerciseName. */
  name?: string;
  trackingType?: TrackingType;
  muscleGroup?: string | null;
  category?: string;
  setNumber?: number;
  weight?: number | null;
  reps?: number | null;
  distance?: number | null;
  time?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  /** Notiz zum Satz (max. 200 Zeichen). */
  note?: string | null;
  // Ausdauergerät (Cardio): Dauer in time, Distanz in distance (Meter)
  /** Widerstandsstufe bzw. Steigung. */
  level?: number | null;
  /** Durchschnittsleistung in Watt. */
  power?: number | null;
  /** Durchschnittspuls. */
  heartRate?: number | null;
  /** Trittfrequenz bzw. Schläge pro Minute. */
  cadence?: number | null;
  calories?: number | null;
  /** Von der Übung übernommen (Server bzw. Katalog). */
  isAssisted?: boolean;
  perSide?: boolean;
}

export type QueueStatusValue = 'pending' | 'failed';

export interface Workout {
  id?: number | null;
  clientId?: string | null;
  date: string;
  workoutType: WorkoutType | string;
  durationSeconds?: number | null;
  sessionRpe?: number | null;
  /** Qualität der Einheit 1-10 (wie gut lief es, unabhängig von der Anstrengung). */
  quality?: number | null;
  notes?: string | null;
  programDayId?: number | null;
  updatedAt?: string;
  /** Studio der Einheit (Geräte und Gewichte unterscheiden sich). */
  gym?: string | null;
  exerciseNotes?: ExerciseNote[] | null;
  sets: WorkoutSet[];
  /** Nur bei Spielen (workoutType "Match"). */
  match?: MatchDetails | null;
  // Nur lokal (noch nicht synchronisiert)
  pending?: boolean;
  op?: 'create' | 'update';
  status?: QueueStatusValue;
  error?: string | null;
}

/** Eintrag der Offline-Warteschlange. */
export interface MatchDetails { goals?: number | null; assists?: number | null; opponent?: string | null }

export interface QueueEntry {
  clientId: string;
  op?: 'create' | 'update';
  workoutId?: number | null;
  date: string;
  workoutType: WorkoutType | string;
  durationSeconds?: number | null;
  sessionRpe?: number | null;
  /** Qualität der Einheit 1-10 (wie gut lief es, unabhängig von der Anstrengung). */
  quality?: number | null;
  notes?: string | null;
  programDayId?: number | null;
  gym?: string | null;
  exerciseNotes?: ExerciseNote[] | null;
  sets: WorkoutSet[];
  match?: MatchDetails | null;
  status: QueueStatusValue;
  attempts: number;
  error: string | null;
}

export interface ProgramExercise {
  id?: number;
  position?: number;
  exerciseId: number;
  exerciseName?: string;
  trackingType?: TrackingType;
  muscleGroup?: string | null;
  sets: number;
  repsMin?: number | null;
  repsMax?: number | null;
  distance?: number | null;
  time?: number | null;
  targetRpe?: number | null;
  restSeconds?: number | null;
  progressionStep?: number | null;
  /** Prozent des geschätzten 1RM (prozentbasiert statt Double Progression). */
  percentOf1Rm?: number | null;
  note?: string | null;
  /** Änderungen ab bestimmten Wochen (Periodisierung). */
  weekSteps?: WeekStep[];
}

export interface WeekStep {
  fromWeek: number;
  sets?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  distance?: number | null;
  time?: number | null;
  percentOf1Rm?: number | null;
  targetRpe?: number | null;
  note?: string | null;
}

export interface ProgramDay {
  id: number;
  position: number;
  name: string;
  notes: string | null;
  exercises: ProgramExercise[];
}

export interface TrainingProgram {
  id: number;
  name: string;
  goal: ProgramGoal | string;
  weeks: number;
  isActive: boolean;
  startedAt: string | null;
  createdAt: string;
  templateKey: string | null;
  days: ProgramDay[];
  /** Wochen-Stufen wiederholen sich alle N Wochen (z. B. 4 bei 5/3/1). */
  cycleWeeks?: number | null;
  /** Jede N-te Woche Entlastung. */
  deloadEvery?: number | null;
  /** Wochenplan: Trainingstage als Bitmaske Mo = 1 ... So = 64 (0 = nicht festgelegt). */
  trainingDays?: number;
  /** Spieltage, Bitmaske wie trainingDays. */
  matchDays?: number;
}

export interface ProgramTemplate {
  key: string;
  name: string;
  description: string;
  goal: ProgramGoal | string;
  level: string;
  weeks: number;
  days: { name: string; notes?: string | null; exercises: ProgramExercise[] }[];
  daysPerWeek?: number;
  sessionsPerWeek?: number | null;
  cycleWeeks?: number | null;
  deloadEvery?: number | null;
  category?: 'Football' | 'Gym' | string;
  sources?: { title: string; url: string }[];
}

export interface AuthUser {
  userId: number;
  username: string;
}

/** Antwort auf Login/Registrierung/Reset. Die Browser-App bekommt keinen Token (Sitzung im httpOnly-Cookie). */
export interface AuthResult extends AuthUser {
  token?: string | null;
  recoveryCodes?: string[] | null;
}

export interface Profile {
  id: number;
  username: string;
  createdAt: string;
  workoutCount: number;
  customExerciseCount: number;
  email: string | null;
  emailVerified: boolean;
  recoveryCodesRemaining: number;
}

export interface WorkoutChanges {
  workouts: Workout[];
  deletedIds: number[];
  nextCursor: string | null;
  syncToken: string;
}
