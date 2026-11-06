// Unterschiede zwischen dem aktuellen Programm und einem Änderungsvorschlag des KI-Coachs - damit man vor dem Übernehmen
// genau sieht, was hinzukommt, wegfällt oder sich ändert. Tage werden über ihre ID zugeordnet (wie beim Speichern).

import type { ProgramDay, ProgramExercise } from '../types';

export interface DiffItem {
  exerciseId: number;
  sets: number;
  repsMin?: number | null;
  repsMax?: number | null;
  distance?: number | null;
  time?: number | null;
  targetRpe?: number | null;
  restSeconds?: number | null;
}

export interface DayDiff {
  name: string;
  status: 'new' | 'changed' | 'same' | 'removed';
  /** Alter Name, falls umbenannt. */
  renamedFrom?: string;
  added: DiffItem[];
  removed: DiffItem[];
  changed: { from: DiffItem; to: DiffItem }[];
}

const same = (a: DiffItem, b: DiffItem) =>
  a.sets === b.sets && (a.repsMin ?? null) === (b.repsMin ?? null) && (a.repsMax ?? a.repsMin ?? null) === (b.repsMax ?? b.repsMin ?? null)
  && (a.distance ?? null) === (b.distance ?? null) && (a.time ?? null) === (b.time ?? null)
  && (a.targetRpe ?? null) === (b.targetRpe ?? null) && (a.restSeconds ?? null) === (b.restSeconds ?? null);

function diffExercises(before: readonly DiffItem[], after: readonly DiffItem[]) {
  const added = after.filter((x) => !before.some((b) => b.exerciseId === x.exerciseId));
  const removed = before.filter((b) => !after.some((x) => x.exerciseId === b.exerciseId));
  const changed = after.flatMap((x) => {
    const b = before.find((y) => y.exerciseId === x.exerciseId);
    return b && !same(b, x) ? [{ from: b, to: x }] : [];
  });
  return { added, removed, changed };
}

export function programDiff(
  current: readonly ProgramDay[],
  next: readonly { id?: number | null; name: string; exercises: DiffItem[] }[],
): DayDiff[] {
  const out: DayDiff[] = next.map((d) => {
    const old = d.id != null ? current.find((c) => c.id === d.id) : undefined;
    if (!old) return { name: d.name, status: 'new', added: [...d.exercises], removed: [], changed: [] };
    const ex = diffExercises(old.exercises as ProgramExercise[], d.exercises);
    const renamed = old.name !== d.name ? old.name : undefined;
    const status = ex.added.length || ex.removed.length || ex.changed.length || renamed ? 'changed' : 'same';
    return { name: d.name, status, renamedFrom: renamed, ...ex };
  });
  for (const c of current) {
    if (!next.some((d) => d.id === c.id)) out.push({ name: c.name, status: 'removed', added: [], removed: [...c.exercises], changed: [] });
  }
  return out;
}
