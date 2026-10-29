// Datenexport (Recht auf Datenübertragbarkeit, Art. 20 DSGVO) als JSON oder CSV.
import { epley1RM, setVolume, trackingOf, sessionLoad } from './analytics';
import type { Workout } from '../types';

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJson(username: string, workouts: readonly Workout[]): void {
  const data = { app: 'SprintLog', version: 3, exportedAt: new Date().toISOString(), user: username, workouts };
  download(`sprintlog-${username}-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Eine Zeile pro Satz. Trennzeichen ";" + BOM, damit Excel (DE) die Datei direkt korrekt öffnet. */
export function toCsv(workouts: readonly Workout[]): string {
  const header = ['date', 'workout_id', 'workout_type', 'duration_min', 'exercise', 'muscle_group', 'tracking_type',
    'set', 'warmup', 'rpe', 'weight_kg', 'reps', 'distance_m', 'time_s', 'volume_kg', 'e1rm_kg', 'session_rpe', 'load', 'notes', 'synced'];
  const rows = [header.join(';')];
  for (const w of workouts) {
    (w.sets ?? []).forEach((s, i) => {
      rows.push([
        new Date(w.date).toISOString(),
        w.id ?? w.clientId,
        w.workoutType,
        w.durationSeconds ? Math.round(w.durationSeconds / 60) : '',
        s.exerciseName,
        s.muscleGroup ?? '',
        trackingOf(s),
        s.setNumber ?? i + 1,
        s.isWarmup ? 'yes' : '',
        s.rpe ?? '',
        s.weight ?? '',
        s.reps ?? '',
        s.distance ?? '',
        s.time ?? '',
        setVolume(s) || '',
        s.isWarmup ? '' : epley1RM(s.weight, s.reps) || '',
        w.sessionRpe ?? '',
        sessionLoad(w) || '',
        i === 0 ? w.notes ?? '' : '',
        w.pending ? 'no' : 'yes',
      ].map(csvCell).join(';'));
    });
  }
  return '﻿' + rows.join('\r\n');
}

export function exportCsv(username: string, workouts: readonly Workout[]): void {
  download(`sprintlog-${username}-${stamp()}.csv`, toCsv(workouts), 'text/csv;charset=utf-8');
}
