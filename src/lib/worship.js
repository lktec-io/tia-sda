// Digital Worship Duty Scheduler (Mfumo wa Kupanga Wahudumu): shared roster model.
// One Firestore document per Sabbath in `worshipSchedules`, id = sabatoDate (YYYY-MM-DD),
// so a week can never have two competing rosters.
// Keep sections/fields + DUTY_MAX in sync with isValidWorshipSchedule() in firestore.rules.

export const WORSHIP_COLLECTION = 'worshipSchedules';
export const DUTY_MAX = 120;

// `time` is Swahili clock time (counted from 6 AM / 6 PM); `clock` is the 12-hour equivalent.
export const ROSTER_SECTIONS = [
  {
    key: 'midweek',
    title: 'Mid-Week Services',
    sw: 'Ibada za Katikati ya Wiki',
    fields: [
      {
        key: 'wednesdayPrayer',
        label: 'Jumatano ya Maombi',
        en: 'Wednesday Prayer Meeting',
        time: 'Saa 11:00 Jioni',
        clock: '5:00 PM',
        dayOffset: -3
      },
      {
        key: 'fridayVespers',
        label: 'Ijumaa ya Kufungua Sabato',
        en: 'Friday Sabbath Opening',
        time: 'Saa 12:00 Jioni',
        clock: '6:00 PM',
        dayOffset: -1
      }
    ]
  },
  {
    key: 'sabbathSchool',
    title: 'Sabbath School',
    sw: 'Shule ya Sabato',
    time: 'Saa 3:00 Asubuhi',
    clock: '9:00 AM',
    fields: [
      { key: 'chair', label: 'Mwenyekiti', en: 'Chairperson' },
      { key: 'memoryVerse', label: 'Fungu la Kukariri', en: 'Memory Verse' },
      { key: 'missionStory', label: 'Somo la Utume', en: 'Mission Story' },
      { key: 'lessonStudy', label: 'Somo la Ukuuzaji', en: 'Lesson Study' }
    ]
  },
  {
    key: 'divineService',
    title: 'Divine Service',
    sw: 'Ibada Kuu',
    time: 'Saa 5:00 Asubuhi',
    clock: '11:00 AM',
    fields: [
      { key: 'chair', label: 'Mwenyekiti', en: 'Chairperson' },
      { key: 'mainScripture', label: 'Fungu Kuu', en: 'Main Scripture' },
      { key: 'preacher', label: 'Mhubiri Mkuu', en: 'Main Preacher' },
      { key: 'offering', label: 'Somo la Sadaka', en: 'Offering Reading' }
    ]
  }
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date for "YYYY-MM-DD" (noon, so DST shifts never change the day). */
export const parseSabatoDate = (value) => {
  if (!DATE_PATTERN.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getMonth() === m - 1 ? date : null;
};

const pad = (n) => String(n).padStart(2, '0');
export const toSabatoId = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const isSaturday = (value) => parseSabatoDate(value)?.getDay() === 6;

/** The Sabbath of the week containing `ms` (today if it is Saturday), as "YYYY-MM-DD". */
export const upcomingSabbathId = (ms) => {
  const date = new Date(ms);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  return toSabatoId(date);
};

/** Date of a weekday relative to the Sabbath (e.g. -3 = Wednesday). */
export const dayOfWeek = (sabatoDate, offset) => {
  const date = parseSabatoDate(sabatoDate);
  if (!date) return null;
  date.setDate(date.getDate() + offset);
  return date;
};

export const formatRosterDate = (value, { weekday = true, long = false } = {}) => {
  const date = value instanceof Date ? value : parseSabatoDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', {
    ...(weekday ? { weekday: long ? 'long' : 'short' } : {}),
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric'
  });
};

/** Empty form state: { sabatoDate, midweek: {…}, sabbathSchool: {…}, divineService: {…} }. */
export const emptyRoster = (sabatoDate = '') => ({
  sabatoDate,
  ...Object.fromEntries(
    ROSTER_SECTIONS.map((section) => [section.key, Object.fromEntries(section.fields.map((f) => [f.key, '']))])
  )
});

/** Normalises a stored document (or partial data) into the full form shape. */
export const rosterFrom = (data) => {
  const base = emptyRoster(data?.sabatoDate || '');
  ROSTER_SECTIONS.forEach((section) => {
    section.fields.forEach((f) => {
      base[section.key][f.key] = data?.[section.key]?.[f.key] || '';
    });
  });
  return base;
};

/** Trimmed duty fields only (what is saved to Firestore). */
export const cleanRoster = (form) =>
  Object.fromEntries(
    ROSTER_SECTIONS.map((section) => [
      section.key,
      Object.fromEntries(section.fields.map((f) => [f.key, (form[section.key]?.[f.key] || '').trim()]))
    ])
  );

/** How many duty slots are assigned, out of the total. */
export const rosterProgress = (data) => {
  const all = ROSTER_SECTIONS.flatMap((section) => section.fields.map((f) => data?.[section.key]?.[f.key]));
  return { filled: all.filter((v) => typeof v === 'string' && v.trim()).length, total: all.length };
};

/**
 * Splits rosters (sorted by sabatoDate desc) around today:
 * current = this week's Sabbath, or the nearest upcoming one;
 * upcoming = later weeks; past = earlier weeks (newest first).
 */
export function splitRosters(rosters, nowMs) {
  const thisSabbath = upcomingSabbathId(nowMs);
  const future = rosters.filter((r) => r.sabatoDate >= thisSabbath);
  const past = rosters.filter((r) => r.sabatoDate < thisSabbath);
  const current = future.length ? future[future.length - 1] : null;
  const upcoming = future.slice(0, -1).reverse();
  return { current, upcoming, past, thisSabbath };
}
