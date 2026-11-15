// Bibliothek fertiger Routinen für Fußballer: Verletzungsprävention (FIFA 11+, Nordic, Copenhagen, Sprunggelenk),
// Mobilität, Sprint-Aktivierung, Regeneration nach dem Spiel, Rumpf. Texte liegen in i18n (routineLibrary.items.<id>),
// hier nur Aufbau, Tage, Dauer und Katalog-Übungen (Ids wie im Server-Seed). Übernehmen = Editor mit Vorlage öffnen.
import { EVERY_DAY, addDays, type RoutineKind } from './routines';
import { bit, type Schedule } from './schedule';
import { tDynamic } from '../i18n';
import type { RoutineDraft } from '../stores/routines';

export const LIBRARY_IDS = ['fifa11', 'nordic', 'copenhagen', 'ankle', 'hips', 'sprint', 'recovery', 'core'] as const;
export type LibraryId = (typeof LIBRARY_IDS)[number];

/** Tage fest (Bitmaske), an Trainingstagen des Plans oder am Tag nach dem Spiel. */
export type LibraryDays = number | 'training' | 'afterMatch';

export interface LibraryTemplate {
  id: LibraryId;
  kind: RoutineKind;
  days: LibraryDays;
  /** Ersatz, wenn der Plan keine passenden Tage hat. */
  fallbackDays: number;
  timesPerDay: number;
  /** Dauer in Wochen; null = Dauer-Gewohnheit. */
  weeks: number | null;
  /** Ungefähre Dauer einer Einheit in Minuten. */
  minutes: number;
  /** Katalog-Übung je Schritt (null = nur Text). Anzahl = Anzahl der Schritte in den Texten. */
  steps: (number | null)[];
  /** Gut belegt (Studien) - Kennzeichen in der Bibliothek. */
  evidence: boolean;
}

const MON = bit(0), TUE = bit(1), WED = bit(2), THU = bit(3), FRI = bit(4), SAT = bit(5), SUN = bit(6);

// Katalog-Ids (SprintLog.Api/Data/AppDbContext.cs)
const EX = {
  plank: 47, sidePlank: 48, nordic: 50, squat: 105, cmj: 90, balance: 86, copenhagen: 85, lateralLunge: 103, adductorStretch: 247,
  ankleMobility: 248, singleCalf: 201, lateralBounds: 91, hip9090: 242, couch: 243, worlds: 244, thoracic: 249, legSwings: 251,
  aSkips: 92, gluteBridge: 39, singleBridge: 263, flying: 89, foam: 252, bike: 84, hamstringStretch: 245, hipFlexor: 246, catCow: 250,
  deadBug: 104, pallof: 96, hollow: 95,
} as const;

export const ROUTINE_LIBRARY: readonly LibraryTemplate[] = [
  { id: 'fifa11', kind: 'prevention', days: 'training', fallbackDays: TUE | THU, timesPerDay: 1, weeks: null, minutes: 20, evidence: true,
    steps: [null, EX.plank, EX.sidePlank, EX.nordic, EX.balance, EX.squat, EX.cmj, null, null, null] },
  { id: 'nordic', kind: 'prevention', days: MON | THU, fallbackDays: MON | THU, timesPerDay: 1, weeks: 10, minutes: 10, evidence: true,
    steps: [EX.legSwings, EX.nordic, EX.singleBridge] },
  { id: 'copenhagen', kind: 'prevention', days: MON | WED | FRI, fallbackDays: MON | WED | FRI, timesPerDay: 1, weeks: 8, minutes: 10, evidence: true,
    steps: [EX.adductorStretch, EX.copenhagen, EX.lateralLunge, EX.sidePlank] },
  { id: 'ankle', kind: 'prevention', days: TUE | THU | SAT, fallbackDays: TUE | THU | SAT, timesPerDay: 1, weeks: 8, minutes: 10, evidence: true,
    steps: [EX.ankleMobility, EX.balance, EX.singleCalf, EX.lateralBounds] },
  { id: 'hips', kind: 'mobility', days: EVERY_DAY, fallbackDays: EVERY_DAY, timesPerDay: 1, weeks: 4, minutes: 12, evidence: false,
    steps: [EX.hip9090, EX.couch, EX.adductorStretch, EX.worlds, EX.thoracic] },
  { id: 'sprint', kind: 'activation', days: 'training', fallbackDays: TUE | THU, timesPerDay: 1, weeks: null, minutes: 12, evidence: false,
    steps: [EX.legSwings, EX.aSkips, null, EX.gluteBridge, null, EX.flying] },
  { id: 'recovery', kind: 'recovery', days: 'afterMatch', fallbackDays: SUN, timesPerDay: 1, weeks: null, minutes: 25, evidence: false,
    steps: [EX.foam, EX.bike, EX.hamstringStretch, EX.hipFlexor, EX.catCow] },
  { id: 'core', kind: 'prevention', days: MON | WED | FRI, fallbackDays: MON | WED | FRI, timesPerDay: 1, weeks: 6, minutes: 10, evidence: false,
    steps: [EX.deadBug, EX.pallof, EX.sidePlank, EX.hollow] },
];

/** Spieltage um einen Tag verschieben (So -> Mo). */
const nextDays = (mask: number): number => ((mask << 1) | (mask >> 6)) & EVERY_DAY;

/** Tage der Vorlage für diesen Plan (Trainingstage, Tag nach dem Spiel) - sonst die Ersatz-Tage. */
export function libraryDays(tpl: LibraryTemplate, schedule: Partial<Schedule> | null): number {
  if (typeof tpl.days === 'number') return tpl.days;
  const mask = tpl.days === 'training' ? schedule?.trainingDays ?? 0 : nextDays(schedule?.matchDays ?? 0) & ~(schedule?.matchDays ?? 0);
  return mask & EVERY_DAY || tpl.fallbackDays;
}

const text = (tpl: LibraryTemplate, path: string) => tDynamic(`routineLibrary.items.${tpl.id}.${path}`, '');

export interface LibraryView {
  tpl: LibraryTemplate;
  title: string;
  summary: string;
  note: string;
  steps: { name: string; dose: string; exerciseId: number | null }[];
}

/** Vorlage mit Texten in der aktuellen Sprache. */
export function libraryView(tpl: LibraryTemplate): LibraryView {
  return {
    tpl,
    title: text(tpl, 'title'),
    summary: text(tpl, 'summary'),
    note: text(tpl, 'note'),
    steps: tpl.steps.map((exerciseId, i) => ({ name: text(tpl, `steps.s${i + 1}.name`), dose: text(tpl, `steps.s${i + 1}.dose`), exerciseId })),
  };
}

/** Entwurf für den Routinen-Editor (Beginn heute, Ende nach der Dauer). */
export function libraryDraft(tpl: LibraryTemplate, today: string, schedule: Partial<Schedule> | null): RoutineDraft {
  const v = libraryView(tpl);
  return {
    title: v.title.slice(0, 60),
    kind: tpl.kind,
    days: libraryDays(tpl, schedule),
    startDate: today,
    endDate: tpl.weeks ? addDays(today, tpl.weeks * 7 - 1) : null,
    reason: v.note.slice(0, 300) || null,
    steps: v.steps.map((s) => ({ name: s.name.slice(0, 80), dose: s.dose.slice(0, 60) || null, exerciseId: s.exerciseId })),
    timesPerDay: tpl.timesPerDay,
    times: [],
  };
}
