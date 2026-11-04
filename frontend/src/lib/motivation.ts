// Motivations-Zeilen: kurz, sachlich, mit echtem Trainings-Hinweis (Deload nach Pause, kein schweres Gym am Spieltag).
// Startbildschirm: eine Zeile, Auswahl nach Priorität, pro Tag stabil (Rotation über die Tagesnummer).
// Ereignisse (Start, Rekord, Ende): rotierender Zähler pro Auslöser, damit sich nichts direkt wiederholt.

import { locale } from '../i18n';
import { readJson, writeJson } from './storage';

export const MOTIVATION = {
  en: {
    startMorning: [
      'Morning, {name}. Early work is the work nobody sees.',
      'The first session of the day sets the tone. Make it clean.',
      'Morning, {name}. Fresh legs, clear head - use both.',
      'Quality reps now, recovery all day.',
      '{name}, the day is still empty. Put something good in it.',
      'Early start. Warm up properly, then go to work.',
    ],
    startEvening: [
      'Evening, {name}. One focused hour still fits today.',
      'Long day? The session can be short and sharp.',
      '{name}, close the day on your terms.',
      'Late session? Keep it crisp and get to bed on time.',
      'Train or recover - just make it a decision.',
      'Tired from work is not tired from training. Warm up and see.',
    ],
    startDefault: [
      '{name}, what are we building today?',
      'Consistency beats intensity. Show up again.',
      'Small sessions, stacked weekly, build big seasons.',
      'Ready when you are, {name}.',
      'Train for the 85th minute, not the first.',
      'The level you want is built on ordinary days like this one.',
    ],
    comeback: [
      '{days} days off. Start lighter than you think and build back up.',
      'Back after {days} days. One session and the rhythm returns.',
      '{days} days out. No catching up - just today’s session.',
      '{days} days away. Easy start, clean technique, no ego.',
      'Breaks happen. Coming back is the part that matters.',
      'After {days} days off, the goal is rhythm, not records.',
    ],
    streak: [
      '{streak} days in a row. This is what consistency looks like.',
      '{streak} straight days. Keep the rhythm, respect recovery.',
      'Streak: {streak} days. Earned, not given.',
      '{streak} days running. Make today’s quality match the streak.',
      '{streak} days in a row. If your body asks for rest, that counts too.',
      '{streak} days. Momentum is real - use it wisely.',
    ],
    weekStrong: [
      '{count} sessions this week. Strong week.',
      '{count} sessions in the bag. Quality over quantity from here.',
      'Week so far: {count} sessions. That’s a serious week.',
      '{count} sessions this week. Plan your recovery like your training.',
      '{count} this week. Your load is building - sleep and eat to match.',
      '{count} sessions down. Finish the week as sharp as you started.',
    ],
    sessionStart: [
      'Session on. Focus on the next set.',
      'Clock’s running. Quality first.',
      'Let’s work.',
      'Warm up properly. The good sets come later.',
      'Locked in. One set at a time.',
      'Good reps, honest RPE.',
    ],
    matchDay: [
      'Match day. Everything this week was for the next 90 minutes.',
      'Match day. Eat early, warm up properly, play your game.',
      'Game day. No heavy lifting - save it for the pitch.',
      'Match day. Trust the work. Play fast.',
      'Today the training shows up. Go and play.',
      'Match day. Hydrate, stay loose, be ready from minute one.',
    ],
    personalRecord: [
      'New best: {exercise}, {weight} kg.',
      '{exercise} {weight} kg. New record. Logged.',
      'PR. {exercise} at {weight} kg - progress you can measure.',
      '{weight} kg on {exercise}. The work is paying off.',
      'Record: {exercise} {weight} kg. Now make it your working weight.',
      '{exercise}, {weight} kg. You’ve never been this strong here.',
    ],
    finish: [
      'Session saved. Recovery starts now.',
      'Done and logged. Eat, hydrate, sleep.',
      'Another one in the books.',
      'Logged. Consistency like this compounds.',
      'Work done. Now let it turn into progress.',
      'Saved. Tomorrow’s session starts with tonight’s sleep.',
    ],
    finishHard: [
      'That was a hard one. Respect it with proper recovery.',
      'High effort today. Plan the next day lighter.',
      'Heavy session logged. Protein, fluids, early night.',
      'You went deep today. Recovery is now part of the session.',
      'Hard work logged. The adaptation happens while you rest.',
      'Big effort. If your legs feel heavy tomorrow, adjust the plan.',
    ],
    milestone: [
      'Workout number {total}. That’s a habit, not a phase.',
      '{total} sessions logged. That’s a foundation.',
      'Session {total}. Every one of them is in the data.',
      '{total} workouts. The long game is working.',
      'Milestone: {total} sessions. Keep stacking.',
      '{total} sessions. Look back at session one - then keep going.',
    ],
    restDay: [
      'Rest day. This is where training turns into progress.',
      'Planned rest. Recovery is part of the program, not a break from it.',
      'Day off from load, not from the plan. Sleep, eat, move easy.',
      'Rest day. Fresh legs win sprints.',
      'No session today - by design. Come back sharper.',
      'Recovery day. Walk, stretch, sleep. That’s the job today.',
    ],
    rehab: [
      'Rehab is training. Same focus, same standards.',
      'Patience now, speed later.',
      'Every clean rep today protects the next season.',
      'Follow the plan, not the ego. Return when you’re ready, not before.',
      'Pain-free and controlled beats heavy and fast. For now.',
      'Comeback in progress. Build it to last.',
    ],
    goalReached: [
      'Goal reached: {exercise}, {weight} kg. Time to set the next one.',
      '{weight} kg on {exercise}. Target hit - exactly as planned.',
      'Goal done: {exercise} at {weight} kg. Weeks of work, one set.',
      '{exercise}, {weight} kg. Goal reached. What’s next?',
      'Target reached: {weight} kg {exercise}. Earned rep by rep.',
      '{exercise} {weight} kg - goal complete. Raise the bar.',
    ],
  },
  de: {
    startMorning: [
      'Guten Morgen, {name}. Frühe Arbeit sieht keiner - aber man merkt sie.',
      'Die erste Einheit des Tages gibt den Ton an.',
      'Morgen, {name}. Frische Beine, klarer Kopf - nutz beides.',
      'Jetzt saubere Wiederholungen, den Rest des Tages Regeneration.',
      '{name}, der Tag ist noch leer. Füll ihn mit was Gutem.',
      'Früher Start. Ordentlich aufwärmen, dann an die Arbeit.',
    ],
    startEvening: [
      'Guten Abend, {name}. Eine fokussierte Stunde geht heute noch.',
      'Langer Tag? Die Einheit darf kurz und knackig sein.',
      '{name}, beende den Tag zu deinen Bedingungen.',
      'Späte Einheit? Halt sie kompakt und geh rechtzeitig schlafen.',
      'Trainieren oder regenerieren - Hauptsache, du entscheidest bewusst.',
      'Müde vom Tag ist nicht müde vom Training. Aufwärmen und schauen.',
    ],
    startDefault: [
      '{name}, woran arbeiten wir heute?',
      'Konstanz schlägt Intensität. Heute wieder.',
      'Kleine Einheiten, Woche für Woche - so entstehen starke Saisons.',
      'Bereit, wenn du es bist, {name}.',
      'Trainier für die 85. Minute, nicht für die erste.',
      'Dein Ziel-Level entsteht an ganz normalen Tagen wie heute.',
    ],
    comeback: [
      '{days} Tage Pause. Starte leichter als gedacht und bau auf.',
      'Zurück nach {days} Tagen. Eine Einheit, und der Rhythmus kommt.',
      '{days} Tage raus. Nichts nachholen - nur die Einheit von heute.',
      '{days} Tage weg. Locker einsteigen, saubere Technik, kein Ego.',
      'Pausen passieren. Entscheidend ist das Zurückkommen.',
      'Nach {days} Tagen zählt Rhythmus, nicht Rekorde.',
    ],
    streak: [
      '{streak} Tage am Stück. So sieht Konstanz aus.',
      '{streak} Tage in Folge. Rhythmus halten, Regeneration respektieren.',
      'Serie: {streak} Tage. Verdient, nicht geschenkt.',
      '{streak} Tage am Stück. Jetzt muss die Qualität mithalten.',
      '{streak} Tage in Folge. Braucht der Körper Ruhe, gehört die dazu.',
      '{streak} Tage. Der Schwung ist da - nutz ihn klug.',
    ],
    weekStrong: [
      '{count} Einheiten diese Woche. Starke Woche.',
      '{count} Einheiten im Sack. Ab jetzt Qualität vor Menge.',
      'Bisher {count} Einheiten. Das ist eine richtige Trainingswoche.',
      '{count} Einheiten diese Woche. Plan die Regeneration wie das Training.',
      '{count} diese Woche. Die Belastung steigt - zieh Schlaf und Essen mit.',
      '{count} Einheiten durch. Bring die Woche sauber zu Ende.',
    ],
    sessionStart: [
      'Einheit läuft. Fokus auf den nächsten Satz.',
      'Die Uhr läuft. Qualität zuerst.',
      'An die Arbeit.',
      'Ordentlich aufwärmen. Die guten Sätze kommen später.',
      'Fokussiert. Ein Satz nach dem anderen.',
      'Saubere Wiederholungen, ehrliche RPE.',
    ],
    matchDay: [
      'Spieltag. Die ganze Woche war für diese 90 Minuten.',
      'Spieltag. Früh essen, sauber aufwärmen, dein Spiel spielen.',
      'Spieltag. Kein schweres Gym heute - die Kraft gehört dem Platz.',
      'Spieltag. Vertrau der Arbeit. Spiel schnell.',
      'Heute zeigt sich das Training. Geh raus und spiel.',
      'Spieltag. Trinken, locker bleiben, ab Minute eins da sein.',
    ],
    personalRecord: [
      'Neue Bestleistung: {exercise}, {weight} kg.',
      '{exercise} {weight} kg. Neuer Rekord. Gespeichert.',
      'PR. {exercise} mit {weight} kg - Fortschritt, den man messen kann.',
      '{weight} kg bei {exercise}. Die Arbeit zahlt sich aus.',
      'Rekord: {exercise} {weight} kg. Jetzt mach es zum Arbeitsgewicht.',
      '{exercise}, {weight} kg. So stark warst du hier noch nie.',
    ],
    finish: [
      'Einheit gespeichert. Ab jetzt läuft die Regeneration.',
      'Erledigt und geloggt. Essen, trinken, schlafen.',
      'Wieder eine im Kasten.',
      'Geloggt. Solche Konstanz zahlt sich mit Zinsen aus.',
      'Arbeit erledigt. Jetzt wird daraus Fortschritt.',
      'Gespeichert. Die nächste Einheit beginnt mit dem Schlaf heute Nacht.',
    ],
    finishHard: [
      'Das war hart. Respektier es mit guter Regeneration.',
      'Hohe Belastung heute. Plan den nächsten Tag leichter.',
      'Schwere Einheit geloggt. Protein, Flüssigkeit, früh ins Bett.',
      'Du bist heute tief gegangen. Jetzt gehört Regeneration dazu.',
      'Harte Arbeit geloggt. Die Anpassung passiert in der Pause.',
      'Großer Aufwand. Sind die Beine morgen schwer, pass den Plan an.',
    ],
    milestone: [
      'Training Nummer {total}. Das ist eine Gewohnheit, keine Phase.',
      '{total} Einheiten geloggt. Das ist ein Fundament.',
      'Einheit {total}. Jede einzelne steckt in deinen Daten.',
      '{total} Trainings. Das lange Spiel funktioniert.',
      'Meilenstein: {total} Einheiten. Weiter stapeln.',
      '{total} Einheiten. Schau auf die erste zurück - dann weiter.',
    ],
    restDay: [
      'Ruhetag. Hier wird aus Training Fortschritt.',
      'Geplante Pause. Regeneration ist Teil des Programms, keine Lücke.',
      'Frei von Belastung, nicht vom Plan. Schlafen, essen, locker bewegen.',
      'Ruhetag. Frische Beine gewinnen Sprints.',
      'Heute keine Einheit - mit Absicht. Komm schärfer zurück.',
      'Regenerationstag. Spazieren, dehnen, schlafen. Das ist heute der Job.',
    ],
    rehab: [
      'Reha ist Training. Gleicher Fokus, gleicher Anspruch.',
      'Jetzt Geduld, später Tempo.',
      'Jede saubere Wiederholung heute schützt die nächste Saison.',
      'Folg dem Plan, nicht dem Ego. Zurück, wenn du bereit bist.',
      'Schmerzfrei und kontrolliert schlägt schwer und schnell. Vorerst.',
      'Comeback läuft. Bau es so, dass es hält.',
    ],
    goalReached: [
      'Ziel erreicht: {exercise}, {weight} kg. Zeit für das nächste.',
      '{weight} kg bei {exercise}. Ziel getroffen - genau nach Plan.',
      'Ziel geschafft: {exercise} mit {weight} kg. Wochen Arbeit, ein Satz.',
      '{exercise}, {weight} kg. Ziel erreicht. Was kommt als Nächstes?',
      'Zielgewicht steht: {exercise}, {weight} kg. Hart erarbeitet.',
      '{exercise} {weight} kg - Ziel erledigt. Leg die Latte höher.',
    ],
  },
  ru: {
    startMorning: [
      'Доброе утро, {name}. Утренняя работа - та, которую никто не видит.',
      'Первая тренировка задаёт тон всему дню.',
      'Доброе утро, {name}. Ноги свежие, голова ясная. Работаем.',
      'Сейчас - качественные повторы, весь день - восстановление.',
      '{name}, день пока пустой. Наполни его чем-то стоящим.',
      'Ранний старт. Нормально разомнись - и в работу.',
    ],
    startEvening: [
      'Добрый вечер, {name}. Один сфокусированный час ещё влезает.',
      'Длинный день? Тренировка может быть короткой, но плотной.',
      '{name}, закрой этот день на своих условиях.',
      'Поздняя тренировка? Сделай её компактной и ляг вовремя.',
      'Тренировка или восстановление - главное, чтобы это было решение.',
      'Усталость после дня - не усталость для тренировки. Разомнись и проверь.',
    ],
    startDefault: [
      '{name}, над чем сегодня работаем?',
      'Регулярность сильнее интенсивности. Сегодня - снова.',
      'Небольшие тренировки неделя за неделей - так строится сезон.',
      'Всё готово, {name}. Дело за тобой.',
      'Тренируйся под 85-ю минуту, а не под первую.',
      'Уровень, к которому ты идёшь, строится в обычные дни. Как этот.',
    ],
    comeback: [
      'Пауза: {days} дн. Начни легче, чем хочется, и наращивай.',
      'С последней тренировки: {days} дн. Одна сессия - и ритм вернётся.',
      'Ничего не догоняй. Только сегодняшняя тренировка.',
      'Пауза: {days} дн. Лёгкий вход, чистая техника, без эго.',
      'Паузы случаются. Важно возвращение.',
      'После {days} дн. перерыва цель - ритм, а не рекорды.',
    ],
    streak: [
      'Серия: {streak} дн. подряд. Вот как выглядит регулярность.',
      '{streak} дн. подряд. Держи ритм, уважай восстановление.',
      'Серия: {streak}. Заработано, а не подарено.',
      'Серия: {streak} дн. Пусть качество не отстаёт от серии.',
      'Серия: {streak}. Если тело просит отдыха - это тоже часть плана.',
      '{streak} дн. подряд. Инерция есть - используй её с умом.',
    ],
    weekStrong: [
      'Тренировок за неделю: {count}. Сильная неделя.',
      'На этой неделе уже {count}. Теперь качество важнее объёма.',
      'Тренировок на неделе: {count}. Это уже серьёзная работа.',
      'Тренировок за неделю: {count}. Планируй восстановление так же, как нагрузку.',
      'Уже {count} за неделю. Нагрузка растёт - подтяни сон и питание.',
      'Сессий за неделю: {count}. Доведи неделю до конца так же чётко.',
    ],
    sessionStart: [
      'Тренировка пошла. Фокус на следующий подход.',
      'Время пошло. Качество прежде всего.',
      'Работаем.',
      'Разомнись как следует. Лучшие подходы будут позже.',
      'Фокус. Один подход за раз.',
      'Чистые повторы, честный RPE.',
    ],
    matchDay: [
      'День игры. Вся неделя была ради этих 90 минут.',
      'День игры. Поешь заранее, разомнись как следует, играй свою игру.',
      'Матч сегодня. Никакого тяжёлого зала - сила нужна на поле.',
      'День игры. Доверься работе. Играй быстро.',
      'Сегодня тренировки выходят на поле. Иди и играй.',
      'День игры. Вода, лёгкость, готовность с первой минуты.',
    ],
    personalRecord: [
      'Новый лучший результат: {exercise}, {weight} кг.',
      '{exercise}: {weight} кг. Новый рекорд. Записано.',
      'Рекорд. {exercise}: {weight} кг - прогресс, который можно измерить.',
      '{exercise}: {weight} кг. Работа окупается.',
      'Рекорд: {exercise}, {weight} кг. Теперь сделай этот вес рабочим.',
      '{exercise}: {weight} кг. Такого здесь у тебя ещё не было.',
    ],
    finish: [
      'Тренировка сохранена. Восстановление начинается сейчас.',
      'Сделано и записано. Еда, вода, сон.',
      'Ещё одна в копилку.',
      'Записано. Такая регулярность даёт сложный процент.',
      'Работа сделана. Теперь пусть она превратится в прогресс.',
      'Сохранено. Завтрашняя тренировка начинается с сегодняшнего сна.',
    ],
    finishHard: [
      'Это было тяжело. Ответь на это нормальным восстановлением.',
      'Высокая нагрузка сегодня. Следующий день спланируй легче.',
      'Тяжёлая тренировка записана. Белок, вода, ранний отбой.',
      'Сегодня - на пределе. Теперь восстановление - часть тренировки.',
      'Тяжёлая работа записана. Адаптация происходит во время отдыха.',
      'Большая нагрузка. Если завтра ноги тяжёлые - скорректируй план.',
    ],
    milestone: [
      'Тренировка №{total}. Это уже привычка, а не этап.',
      'Записано тренировок: {total}. Это фундамент.',
      'Тренировка №{total}. Каждая из них есть в твоих данных.',
      'Всего тренировок: {total}. Длинная дистанция работает.',
      'Рубеж: {total}. Продолжай складывать.',
      'Тренировка №{total}. Оглянись на первую - и дальше.',
    ],
    restDay: [
      'День отдыха. Именно сейчас тренировки превращаются в прогресс.',
      'Плановый отдых. Восстановление - часть программы, а не перерыв в ней.',
      'Выходной от нагрузки, не от плана. Сон, еда, лёгкое движение.',
      'День отдыха. Свежие ноги выигрывают спринты.',
      'Сегодня без тренировки - так и задумано. Вернись острее.',
      'День восстановления. Прогулка, растяжка, сон. Это и есть работа.',
    ],
    rehab: [
      'Реабилитация - это тренировка. Тот же фокус, те же стандарты.',
      'Сейчас - терпение, скорость - потом.',
      'Каждый чистый повтор сегодня бережёт следующий сезон.',
      'Следуй плану, а не эго. Возвращение - когда тело готово, не раньше.',
      'Без боли и под контролем лучше, чем тяжело и быстро. Пока что.',
      'Возвращение идёт. Строй его так, чтобы оно держалось.',
    ],
    goalReached: [
      'Цель достигнута: {exercise}, {weight} кг. Время ставить следующую.',
      '{exercise}: {weight} кг. Цель взята - ровно по плану.',
      'Цель закрыта: {exercise}, {weight} кг. Недели работы, один подход.',
      '{exercise}: {weight} кг. Цель достигнута. Что дальше?',
      'Целевой вес взят: {exercise}, {weight} кг. Заработано честно.',
      '{exercise}: {weight} кг - цель выполнена. Поднимай планку.',
    ],
  },
} as const;

export type MotivationKey = keyof (typeof MOTIVATION)['en'];
type Lang = keyof typeof MOTIVATION;
export type MotivationParams = Partial<Record<'name' | 'streak' | 'days' | 'count' | 'exercise' | 'weight' | 'total', string | number>>;

const DAY = 86_400_000;
const OFFSET: Record<MotivationKey, number> = {
  startMorning: 0, startEvening: 1, startDefault: 2, comeback: 3, streak: 4, weekStrong: 5, sessionStart: 0, matchDay: 1,
  personalRecord: 2, finish: 3, finishHard: 4, milestone: 5, restDay: 0, rehab: 1, goalReached: 2,
};

const usableName = (name: unknown) => typeof name === 'string' && !!name && name.length <= 16 && !name.includes('@');

function fill(text: string, params: MotivationParams): string | null {
  let missing = false;
  const out = text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k as keyof MotivationParams];
    if (v == null || v === '') { missing = true; return ''; }
    return String(v);
  });
  return missing ? null : out;
}

function variants(key: MotivationKey, params: MotivationParams, lang?: string): string[] {
  const l = (lang ?? locale.value) as Lang;
  const list = (MOTIVATION[l] ?? MOTIVATION.en)[key] as readonly string[];
  const p = usableName(params.name) ? params : { ...params, name: undefined };
  return list.map((v) => fill(v, p)).filter((v): v is string => !!v);
}

/** Startbildschirm: pro Tag stabil, zwei Tage hintereinander nie dieselbe Zeile (bei gleichem Auslöser). */
export function dailyLine(key: MotivationKey, params: MotivationParams, date = new Date(), lang?: string): string {
  const list = variants(key, params, lang);
  if (!list.length) return '';
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY);
  return list[(day + OFFSET[key]) % list.length];
}

/** Ereignis-Zeile: rotiert pro Auslöser (Zähler im Gerät). */
export function eventLine(key: MotivationKey, params: MotivationParams, lang?: string): string {
  const list = variants(key, params, lang);
  if (!list.length) return '';
  const storeKey = `sprintlog:motivation:${key}`;
  const n = readJson<number>(storeKey, 0);
  writeJson(storeKey, n + 1);
  return list[n % list.length];
}

export interface StartContext {
  now: Date;
  name?: string | null;
  /** Heute schon trainiert? */
  trainedToday: boolean;
  /** Tage seit der letzten Einheit (null = noch nie). */
  daysSinceLast: number | null;
  streak: number;
  weekCount: number;
  todayKind?: 'training' | 'match' | 'rest' | null;
  rehabActive?: boolean;
}

/** Welche Zeile zeigt der Startbildschirm? Priorität: Spieltag > Reha > Comeback > Ruhetag > Serie > Woche > Tageszeit. */
export function startTrigger(c: StartContext): { key: MotivationKey; params: MotivationParams } | null {
  const name = c.name ?? undefined;
  if (c.trainedToday) {
    if (c.streak >= 3) return { key: 'streak', params: { streak: c.streak } };
    if (c.weekCount >= 3) return { key: 'weekStrong', params: { count: c.weekCount } };
    return null;
  }
  if (c.todayKind === 'match') return { key: 'matchDay', params: {} };
  if (c.rehabActive) return { key: 'rehab', params: {} };
  if (c.daysSinceLast != null && c.daysSinceLast >= 5) return { key: 'comeback', params: { days: c.daysSinceLast } };
  if (c.todayKind === 'rest') return { key: 'restDay', params: {} };
  if (c.streak >= 3) return { key: 'streak', params: { streak: c.streak } };
  if (c.weekCount >= 3) return { key: 'weekStrong', params: { count: c.weekCount } };
  const h = c.now.getHours();
  return { key: h < 11 ? 'startMorning' : h >= 17 ? 'startEvening' : 'startDefault', params: { name } };
}

/** Meilensteine: 10, 25, 50, 100, 150, 200 ... */
export const isMilestone = (total: number): boolean => [10, 25, 50, 100].includes(total) || (total > 100 && total % 50 === 0);
