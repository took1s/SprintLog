// Datenexport (Recht auf Datenübertragbarkeit, Art. 20 DSGVO) als JSON oder CSV.
import { epley1RM, setVolume, trackingOf } from './analytics.js';

function download(filename, content, mime) {
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

export function exportJson(username, workouts) {
  const data = { app: 'SprintLog', version: 3, exportedAt: new Date().toISOString(), user: username, workouts };
  download(`sprintlog-${username}-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Eine Zeile pro Satz. Trennzeichen ";" + BOM, damit Excel (DE) die Datei direkt korrekt öffnet. */
export function toCsv(workouts) {
  const header = ['date', 'workout_id', 'workout_type', 'duration_min', 'exercise', 'muscle_group', 'tracking_type',
    'set', 'weight_kg', 'reps', 'distance_m', 'time_s', 'volume_kg', 'e1rm_kg', 'synced'];
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
        s.weight ?? '',
        s.reps ?? '',
        s.distance ?? '',
        s.time ?? '',
        setVolume(s) || '',
        epley1RM(s.weight, s.reps) || '',
        w.pending ? 'no' : 'yes',
      ].map(csvCell).join(';'));
    });
  }
  return '﻿' + rows.join('\r\n');
}

export function exportCsv(username, workouts) {
  download(`sprintlog-${username}-${stamp()}.csv`, toCsv(workouts), 'text/csv;charset=utf-8');
}
