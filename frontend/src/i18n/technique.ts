// Technik-Hinweise auf Deutsch und Russisch. Englisches Original: TECHNIQUE in lib/figure.ts.
// Muskeln werden über ein Wörterbuch übersetzt, Hinweise (cues) pro Bewegung.

import type { Technique } from '../lib/figure';
import { TECHNIQUE } from '../lib/figure';

type Lang = 'de' | 'ru';

const MUSCLES: Record<Lang, Record<string, string>> = {
  de: {
    Forearms: 'Unterarme', Grip: 'Griffkraft', Quads: 'Quadrizeps', Glutes: 'Gesäß', Adductors: 'Adduktoren', Core: 'Rumpf',
    Hamstrings: 'Beinbeuger', 'Lower back': 'Unterer Rücken', Traps: 'Trapez', Chest: 'Brust', Triceps: 'Trizeps',
    'Front delts': 'Vordere Schulter', 'Upper chest': 'Obere Brust', Shoulders: 'Schultern', Lats: 'Latissimus',
    'Upper back': 'Oberer Rücken', 'Rear delts': 'Hintere Schulter', Biceps: 'Bizeps', 'Triceps (long head)': 'Trizeps (langer Kopf)',
    'Side delts': 'Seitliche Schulter', 'Rotator cuff': 'Rotatorenmanschette', 'Mid back': 'Mittlerer Rücken', Calves: 'Waden',
    Abs: 'Bauch', 'Lower abs': 'Unterer Bauch', 'Hip flexors': 'Hüftbeuger', Coordination: 'Koordination', Conditioning: 'Ausdauer',
    Legs: 'Beine', Back: 'Rücken', Arms: 'Arme', 'Glute medius': 'Mittlerer Gesäßmuskel', 'Hip abductors': 'Abduktoren', Obliques: 'Seitliche Bauchmuskeln',
  },
  ru: {
    Forearms: 'Предплечья', Grip: 'Хват', Quads: 'Квадрицепсы', Glutes: 'Ягодицы', Adductors: 'Приводящие', Core: 'Кор',
    Hamstrings: 'Бицепс бедра', 'Lower back': 'Поясница', Traps: 'Трапеции', Chest: 'Грудь', Triceps: 'Трицепс',
    'Front delts': 'Передняя дельта', 'Upper chest': 'Верх груди', Shoulders: 'Плечи', Lats: 'Широчайшие',
    'Upper back': 'Верх спины', 'Rear delts': 'Задняя дельта', Biceps: 'Бицепс', 'Triceps (long head)': 'Трицепс (длинная головка)',
    'Side delts': 'Средняя дельта', 'Rotator cuff': 'Вращательная манжета', 'Mid back': 'Середина спины', Calves: 'Икры',
    Abs: 'Пресс', 'Lower abs': 'Низ пресса', 'Hip flexors': 'Сгибатели бедра', Coordination: 'Координация', Conditioning: 'Выносливость',
    Legs: 'Ноги', Back: 'Спина', Arms: 'Руки', 'Glute medius': 'Средняя ягодичная', 'Hip abductors': 'Отводящие', Obliques: 'Косые мышцы',
  },
};

const CUES: Record<Lang, Record<string, string[]>> = {
  de: {
    wristCurl: ['Unterarme liegen auf den Oberschenkeln oder einer Bank', 'Nur die Handgelenke bewegen sich', 'Voller Bewegungsumfang, langsam und kontrolliert'],
    squat: ['Stange auf dem oberen Rücken, Füße schulterbreit', 'Vor jeder Wiederholung den Rumpf anspannen', 'Knie zeigen in Richtung Zehen, Hüfte auf Kniehöhe oder tiefer', 'Über den ganzen Fuß nach oben drücken'],
    gobletSquat: ['Gewicht vor der Brust halten', 'Zwischen die Knie absetzen', 'Brust oben, Fersen am Boden'],
    deadlift: ['Stange über der Fußmitte, Schienbeine nah an der Stange', 'Neutraler Rücken - anspannen, dann den Boden wegdrücken', 'Hüfte und Schultern steigen gemeinsam', 'Mit dem Gesäß strecken, nicht nach hinten lehnen'],
    rdl: ['Knie leicht gebeugt, Hüfte nach hinten schieben', 'Gewicht gleitet an den Oberschenkeln entlang', 'Stoppen, wenn die Beinbeuger dehnen', 'Rücken bleibt gerade'],
    bench: ['Schulterblätter nach hinten und unten ziehen', 'Füße fest am Boden, leichtes Hohlkreuz', 'Zur Brustmitte absenken, Ellbogen ca. 45°', 'Nach oben und leicht nach hinten drücken'],
    inclineBench: ['Bank auf 30-45°', 'Zur oberen Brust absenken', 'Handgelenke über den Ellbogen'],
    dbBench: ['Kurzhanteln oben über der Brust', 'Langsam auf Brusthöhe absenken', 'Nach oben und leicht zusammen drücken'],
    skullCrusher: ['Oberarme bleiben ruhig und senkrecht', 'Gewicht Richtung Stirn absenken', 'Voll strecken, ohne hart einzurasten'],
    ohp: ['Gesäß anspannen, Rumpf fest - nicht nach hinten lehnen', 'Stange startet vorne auf den Schultern', 'Gerade nach oben drücken, Kopf oben durchschieben'],
    dbPress: ['Start auf Ohrhöhe, Handflächen nach vorn', 'Nach oben drücken, ohne ins Hohlkreuz zu gehen', 'Den Weg nach unten kontrollieren'],
    row: ['Oberkörper vorbeugen, Rücken gerade', 'Zu den unteren Rippen ziehen', 'Oben die Schulterblätter zusammenziehen'],
    dbRow: ['Abstützen, Rücken gerade', 'Ellbogen Richtung Hüfte ziehen', 'Absenken, bis der Arm gestreckt ist'],
    pullup: ['Aus dem toten Hang starten', 'Brust zur Stange, Ellbogen nach unten', 'Kein Schwung - langsam ablassen'],
    pulldown: ['Leicht zurücklehnen, Brust raus', 'Stange zur oberen Brust ziehen', 'Arme oben ganz strecken'],
    curl: ['Ellbogen bleiben am Körper', 'Ohne Schwung hochcurlen', 'Langsam absenken (2-3 s)'],
    barbellCurl: ['Schulterbreiter Griff', 'Ellbogen bleiben ruhig', 'Voller Weg: gestreckter Arm bis volle Kontraktion'],
    pushdown: ['Ellbogen fest am Körper', 'Nach unten drücken, bis die Arme gestreckt sind', 'Nur die Unterarme bewegen sich'],
    overheadExt: ['Ellbogen zeigen nach oben und bleiben eng', 'Gewicht hinter den Kopf absenken', 'Über dem Kopf voll strecken'],
    frontRaise: ['Ellbogen leicht gebeugt', 'Auf Schulterhöhe heben', 'Kein Schwung aus der Hüfte'],
    lateralRaise: ['Mit den Ellbogen führen', 'Bis Schulterhöhe heben, nicht höher', 'Langsam absenken'],
    rearDelt: ['Vorbeugen oder das Maschinenpolster nutzen', 'Arme weit öffnen, Ellbogen leicht gebeugt', 'Hintere Schulter zusammendrücken'],
    shrug: ['Arme bleiben gestreckt', 'Schultern gerade zu den Ohren heben', 'Oben kurz halten'],
    facePull: ['Seil auf Gesichtshöhe', 'Zur Stirn ziehen, Ellbogen hoch', 'Am Ende die Hände nach hinten drehen'],
    straightArm: ['Arme fast gestreckt', 'Stange bis zu den Oberschenkeln ziehen', 'Oberkörper bleibt ruhig'],
    cableRow: ['Aufrecht sitzen, Knie leicht gebeugt', 'Griff zum Bauch ziehen', 'Oberkörper nicht schaukeln'],
    lunge: ['Langer Schritt, Oberkörper aufrecht', 'Hinteres Knie berührt fast den Boden', 'Über die vordere Ferse hochdrücken'],
    calfRaise: ['Unten voll dehnen', 'Auf die Fußballen hochdrücken', 'Oben 1 s halten'],
    hipThrust: ['Oberer Rücken auf der Bank', 'Hüfte hochdrücken, bis der Körper gerade ist', 'Kinn zur Brust, oben das Gesäß anspannen'],
    bridge: ['Füße flach, nah am Gesäß', 'Hüfte über die Fersen hochdrücken', 'Nicht ins Hohlkreuz überstrecken'],
    plank: ['Ellbogen unter den Schultern', 'Gerade Linie von Kopf bis Ferse', 'Gesäß anspannen und atmen'],
    pushup: ['Hände etwas breiter als die Schultern', 'Körper bleibt eine gerade Linie', 'Brust zum Boden, Ellbogen ca. 45°'],
    crunch: ['Unterer Rücken bleibt am Boden', 'Rippen Richtung Becken rollen', 'Nicht am Nacken ziehen'],
    cableCrunch: ['Knien, Seil neben dem Kopf', 'Wirbelsäule Richtung Knie einrollen', 'Hüfte bleibt ruhig'],
    abWheel: ['Auf den Knien starten, Arme gestreckt', 'So weit ausrollen, wie du kontrollieren kannst', 'Unterer Rücken darf nicht durchhängen'],
    legRaise: ['Ruhig hängen, kein Schwung', 'Beine auf Hüfthöhe oder höher heben', 'Langsam absenken'],
    dip: ['Schultern unten, Brust raus', 'Absenken, bis die Oberarme parallel zum Boden sind', 'Bis zu gestreckten Armen hochdrücken'],
    nordic: ['Fersen fixiert, Hüfte gestreckt', 'So langsam wie möglich nach vorne fallen', 'Mit den Händen abfangen, wieder hochdrücken'],
    sprint: ['In der Beschleunigung nach vorn lehnen', 'Knie hoch, Arme kräftig mitnehmen', 'Auf den Fußballen landen', 'Volle Pause zwischen den Sprints'],
    shuttle: ['Vor der Wende die Hüfte senken', 'Äußeren Fuß setzen, kräftig abdrücken', 'Blick nach vorn, kurze schnelle Schritte'],
    ladder: ['Auf den Fußballen bleiben', 'Schnelle, leichte Bodenkontakte', 'Arme arbeiten mit den Beinen'],
    jumpRope: ['Kleine Sprünge, 2-3 cm über dem Boden', 'Seil aus den Handgelenken drehen', 'Locker und im Rhythmus bleiben'],
    rowing: ['Reihenfolge: Beine - Oberkörper - Arme', 'Zurück: Arme - Oberkörper - Beine', 'Die Kraft kommt aus den Beinen'],
    cycling: ['Sattelhöhe: unten Knie leicht gebeugt', 'Gleichmäßig rund treten', 'Oberkörper locker lassen'],
    jump: ['Kurz einfedern, Arme schwingen', 'Explosiv aus der Hüfte hochspringen', 'Weich mit gebeugten Knien landen'],
    boxJump: ['Arme schwingen und auf die Box springen', 'Weich in der halben Hocke landen', 'Heruntersteigen - nicht herunterspringen'],
    broadJump: ['Hüfte laden, Arme nach hinten schwingen', 'Nach vorn und oben springen', 'Landung halten, Knie über den Zehen'],
    wallBall: ['Ball vor der Brust, in die Hocke gehen', 'Mit dem Beinschub werfen', 'Fangen und direkt in die nächste Hocke'],
    legExtension: ['Polster am unteren Schienbein', 'Strecken, bis die Beine gerade sind', 'Langsam absenken, Gewicht nicht fallen lassen'],
    legCurl: ['Knie auf Höhe der Maschinenachse', 'Fersen unter den Sitz ziehen', 'Den Rückweg kontrollieren'],
    legPress: ['Füße schulterbreit auf der Plattform', 'Absenken, bis die Knie ca. 90° haben', 'Knie oben nicht durchstrecken'],
    fly: ['Ellbogen leicht gebeugt und fixiert', 'Öffnen, bis die Brust dehnt', 'Hände vor der Brust zusammenführen'],
    abduction: ['Aufrecht sitzen, Rücken am Polster', 'Knie nach außen drücken', 'Langsam zurück'],
    adduction: ['Aufrecht sitzen, Rücken am Polster', 'Knie zusammendrücken', 'Das Öffnen kontrollieren'],
    twist: ['Leicht zurücklehnen, Brust raus', 'Die Schultern drehen, nicht nur die Arme', 'Anfänger: Füße am Boden'],
    woodchop: ['Arme fast gestreckt', 'Diagonal aus dem Rumpf drehen', 'Auf dem hinteren Fuß mitdrehen'],
  },
  ru: {
    wristCurl: ['Предплечья лежат на бёдрах или скамье', 'Двигаются только запястья', 'Полная амплитуда, медленно и под контролем'],
    squat: ['Гриф на верху спины, стопы на ширине плеч', 'Перед каждым повтором напрягай кор', 'Колени идут по направлению носков, таз до уровня колен или ниже', 'Вставай, давя всей стопой'],
    gobletSquat: ['Держи вес у груди', 'Садись между коленями', 'Грудь вверх, пятки на полу'],
    deadlift: ['Гриф над серединой стопы, голени близко к грифу', 'Спина нейтральная - напрягись и оттолкни пол', 'Таз и плечи поднимаются вместе', 'Выпрямляйся ягодицами, не отклоняйся назад'],
    rdl: ['Колени чуть согнуты, таз уходит назад', 'Вес скользит вдоль бёдер', 'Остановись, когда почувствуешь растяжение бицепса бедра', 'Спина остаётся прямой'],
    bench: ['Лопатки сведены и опущены', 'Стопы упираются в пол, небольшой прогиб', 'Опускай к середине груди, локти примерно 45°', 'Жми вверх и немного назад'],
    inclineBench: ['Скамья под 30-45°', 'Опускай к верху груди', 'Запястья над локтями'],
    dbBench: ['Гантели над грудью в верхней точке', 'Медленно опускай до уровня груди', 'Жми вверх и немного навстречу'],
    skullCrusher: ['Плечи неподвижны и вертикальны', 'Опускай вес к лбу', 'Разгибай полностью, без жёсткого замка'],
    ohp: ['Сожми ягодицы и напряги кор - не отклоняйся', 'Гриф стартует на передней части плеч', 'Жми строго вверх, голова проходит вперёд в верхней точке'],
    dbPress: ['Старт на уровне ушей, ладони вперёд', 'Жми вверх без прогиба в пояснице', 'Контролируй опускание'],
    row: ['Наклонись вперёд, спина прямая', 'Тяни к нижним рёбрам', 'Вверху сведи лопатки'],
    dbRow: ['Обопрись, спина прямая', 'Тяни локоть к бедру', 'Опускай до прямой руки'],
    pullup: ['Старт из полного виса', 'Тяни грудь к перекладине, локти вниз', 'Без раскачки - опускайся под контролем'],
    pulldown: ['Слегка отклонись назад, грудь вперёд', 'Тяни гриф к верху груди', 'Вверху полностью выпрями руки'],
    curl: ['Локти прижаты к корпусу', 'Поднимай без раскачки', 'Опускай медленно (2-3 с)'],
    barbellCurl: ['Хват на ширине плеч', 'Локти неподвижны', 'Полная амплитуда: от прямой руки до полного сокращения'],
    pushdown: ['Локти прижаты к корпусу', 'Дави вниз до прямых рук', 'Двигаются только предплечья'],
    overheadExt: ['Локти смотрят вверх и не расходятся', 'Опускай вес за голову', 'Полностью выпрямляй руки над головой'],
    frontRaise: ['Локти чуть согнуты', 'Поднимай до уровня плеч', 'Без рывка тазом'],
    lateralRaise: ['Веди движение локтями', 'Поднимай до уровня плеч, не выше', 'Опускай медленно'],
    rearDelt: ['Наклонись вперёд или упрись в подушку тренажёра', 'Широко разводи руки, локти чуть согнуты', 'Сжимай заднюю часть плеч'],
    shrug: ['Руки остаются прямыми', 'Поднимай плечи строго к ушам', 'Задержись вверху'],
    facePull: ['Канат на уровне лица', 'Тяни ко лбу, локти высоко', 'В конце разверни кисти назад'],
    straightArm: ['Руки почти прямые', 'Тяни гриф вниз к бёдрам', 'Корпус неподвижен'],
    cableRow: ['Сиди ровно, колени чуть согнуты', 'Тяни рукоять к животу', 'Не раскачивай корпус'],
    lunge: ['Длинный шаг, корпус вертикально', 'Заднее колено почти касается пола', 'Вставай через пятку передней ноги'],
    calfRaise: ['Полное растяжение внизу', 'Поднимайся на подушечки стоп', 'Задержись вверху на 1 с'],
    hipThrust: ['Верх спины на скамье', 'Поднимай таз, пока тело не станет прямым', 'Подбородок к груди, вверху сожми ягодицы'],
    bridge: ['Стопы на полу, близко к ягодицам', 'Поднимай таз, давя пятками', 'Не перегибай поясницу'],
    plank: ['Локти под плечами', 'Прямая линия от головы до пяток', 'Сожми ягодицы и дыши'],
    pushup: ['Руки чуть шире плеч', 'Тело - одна прямая линия', 'Грудь к полу, локти примерно 45°'],
    crunch: ['Поясница остаётся на полу', 'Скручивай рёбра к тазу', 'Не тяни себя за шею'],
    cableCrunch: ['На коленях, канат возле головы', 'Скручивай позвоночник к коленям', 'Таз неподвижен'],
    abWheel: ['Старт на коленях, руки прямые', 'Выкатывайся настолько, насколько контролируешь', 'Не давай пояснице провисать'],
    legRaise: ['Виси спокойно, без раскачки', 'Поднимай ноги до уровня таза или выше', 'Опускай медленно'],
    dip: ['Плечи вниз, грудь вперёд', 'Опускайся, пока плечи не станут параллельны полу', 'Выжимай до прямых рук'],
    nordic: ['Пятки зафиксированы, таз прямой', 'Падай вперёд как можно медленнее', 'Поймай себя руками и оттолкнись обратно'],
    sprint: ['При разгоне наклонись вперёд', 'Колени вверх, активная работа рук', 'Приземляйся на переднюю часть стопы', 'Полный отдых между спринтами'],
    shuttle: ['Перед разворотом опусти таз', 'Поставь внешнюю ногу и мощно оттолкнись', 'Взгляд вперёд, короткие быстрые шаги'],
    ladder: ['Оставайся на передней части стопы', 'Быстрые лёгкие касания', 'Руки работают вместе с ногами'],
    jumpRope: ['Маленькие прыжки, 2-3 см от пола', 'Крути скакалку запястьями', 'Расслабленно и ритмично'],
    rowing: ['Порядок: ноги - корпус - руки', 'Возврат: руки - корпус - ноги', 'Сила идёт от ног'],
    cycling: ['Высота седла: внизу колено чуть согнуто', 'Ровное круговое вращение педалей', 'Верх тела расслаблен'],
    jump: ['Быстрый подсед, мах руками', 'Взрывной толчок тазом вверх', 'Мягкое приземление на согнутые колени'],
    boxJump: ['Мах руками и прыжок на тумбу', 'Мягко приземляйся в полуприсед', 'Сходи вниз - не спрыгивай'],
    broadJump: ['Загрузи таз, отведи руки назад', 'Прыгай вперёд и вверх', 'Зафиксируй приземление, колени над носками'],
    wallBall: ['Мяч у груди, присед', 'Бросай за счёт толчка ногами', 'Поймай и сразу уходи в следующий присед'],
    legExtension: ['Валик на нижней части голени', 'Разгибай до прямых ног', 'Опускай медленно, не роняй вес'],
    legCurl: ['Колени на уровне оси тренажёра', 'Тяни пятки под сиденье', 'Контролируй возврат'],
    legPress: ['Стопы на ширине плеч на платформе', 'Опускай, пока угол в коленях не будет около 90°', 'Не выпрямляй колени до замка'],
    fly: ['Локти чуть согнуты и зафиксированы', 'Разводи до растяжения груди', 'Своди руки перед грудью'],
    abduction: ['Сиди ровно, спина на спинке', 'Разводи колени наружу', 'Медленно возвращай'],
    adduction: ['Сиди ровно, спина на спинке', 'Своди колени', 'Контролируй разведение'],
    twist: ['Слегка отклонись назад, грудь вперёд', 'Поворачивай плечи, а не только руки', 'Новичкам - стопы на полу'],
    woodchop: ['Руки почти прямые', 'Поворот корпусом по диагонали', 'Разворачивайся на задней ноге'],
  },
};

function build(lang: Lang): Record<string, Technique> {
  const out: Record<string, Technique> = {};
  for (const [key, original] of Object.entries(TECHNIQUE)) {
    const cues = CUES[lang][key];
    if (!cues) continue; // fehlt -> Englisch (Fallback in content.ts)
    out[key] = { muscles: original.muscles.map((m) => MUSCLES[lang][m] ?? m), cues };
  }
  return out;
}

export const techniqueTranslations: Partial<Record<'en' | Lang, Record<string, Technique & { label?: string }>>> = {
  de: build('de'),
  ru: build('ru'),
};

/** Für Tests: Bewegungen ohne Übersetzung. */
export const missingTechnique = (lang: Lang): string[] => Object.keys(TECHNIQUE).filter((k) => !CUES[lang][k]);
