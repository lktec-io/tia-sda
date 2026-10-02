import { titleCase } from '../utils/format';

export const ROLE_LABELS = {
  reader: 'Reader',
  member: 'Member',
  associate: 'Associate',
  leader: 'Leader'
};

// Every account is active immediately; role alone decides leader access.
export const isLeaderProfile = (profile) => profile?.role === 'leader';

export const formatRole = (profile) => ROLE_LABELS[profile?.role] || profile?.role || '—';

// ---------------------------------------------------------------- membership fee ledger
// Keep in sync with the feeStatus values allowed in firestore.rules.
export const FEE_PER_SEMESTER_TZS = 2500;
export const FEE_ANNUAL_TZS = 5000;

export const FEE_STATUSES = [
  {
    value: 'unpaid',
    label: 'Unpaid',
    short: 'Unpaid',
    sw: 'Haijalipwa',
    amount: 0,
    percent: 0,
    tone: 'amber',
    chartColor: '#cbd5e1',
    message: 'Ada Haijalipwa • TZS 5,000/Year or TZS 2,500/Semester. Please support the ministry.'
  },
  {
    value: 'semester1_paid',
    label: 'Semester 1 Paid',
    short: 'Sem 1',
    sw: 'Semester 1 Imelipwa',
    amount: FEE_PER_SEMESTER_TZS,
    percent: 50,
    tone: 'sapphire',
    chartColor: '#d4af37',
    message: 'Semester 1 Imekamilika (TZS 2,500 Paid) • Kumbuka kukamilisha ada ya Semester 2.'
  },
  {
    value: 'fully_paid',
    label: 'Fully Paid',
    short: 'Full',
    sw: 'Imekamilika',
    amount: FEE_ANNUAL_TZS,
    percent: 100,
    tone: 'emerald',
    chartColor: '#0f2b46',
    message: 'Ada Imekamilika Kikamilifu (TZS 5,000 Paid) • Thank you for your faithful stewardship!'
  }
];

const FEE_BY_VALUE = Object.fromEntries(FEE_STATUSES.map((s) => [s.value, s]));

/**
 * Current fee status of a profile. Profiles created before the semester ledger only
 * have the boolean `membershipFeePaid` (true → fully paid, false → unpaid).
 */
export function getFeeStatus(profile) {
  if (FEE_BY_VALUE[profile?.feeStatus]) return profile.feeStatus;
  return profile?.membershipFeePaid === true ? 'fully_paid' : 'unpaid';
}

export const feeStatusInfo = (status) => FEE_BY_VALUE[status] || FEE_BY_VALUE.unpaid;

/** "150,000 TZS" */
export const formatTZS = (amount) => `${Math.round(amount || 0).toLocaleString('en-US')} TZS`;

// Audience tags an announcement can be published to.
export const VISIBILITY_OPTIONS = [
  { value: 'reader', label: 'Readers', hint: 'Public website & visitors' },
  { value: 'member', label: 'Members', hint: 'Active student members' },
  { value: 'associate', label: 'Associates', hint: 'Alumni & supporters' }
];

export const ANNOUNCEMENT_CATEGORIES = [
  'Sabbath Service',
  'Choir',
  'Welfare',
  'Evangelism',
  'Fellowship',
  'General'
];

// Maps a category to its badge colour class (see .cat-* in dashboard.css).
export const CATEGORY_CLASS = {
  'Sabbath Service': 'cat-sabbath',
  Choir: 'cat-choir',
  Welfare: 'cat-welfare',
  Evangelism: 'cat-evangelism',
  Fellowship: 'cat-fellowship',
  General: 'cat-general'
};

export const YEAR_OPTIONS = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
  { value: 'N/A', label: 'Not Applicable' }
];

// ---------------------------------------------------------------- ministry wings
export const MINISTRY_WINGS = [
  { value: 'None', label: 'None' },
  { value: 'Choir', label: 'TUCASA Choir' },
  { value: 'Evangelism', label: 'Evangelism Team' },
  { value: 'Welfare', label: 'Welfare Team' },
  { value: 'Media', label: 'Media & Technical' }
];

export const ministryLabel = (value) =>
  MINISTRY_WINGS.find((w) => w.value === value)?.label || value || 'None';

// ---------------------------------------------------------------- engagement analytics
// Monthly counts leaders record in users/{uid}/engagement/{YYYY-MM}.
// Keep keys + ENGAGEMENT_MAX in sync with isValidEngagement() in firestore.rules.
export const ENGAGEMENT_MAX = 31;

export const ENGAGEMENT_METRICS = [
  { key: 'attendance', label: 'Service Attendance', sw: 'Mahudhurio ya Ibada', color: '#0f2b46' },
  { key: 'welfare', label: 'Welfare Meetings', sw: 'Vikao vya Ustawi', color: '#d4af37' },
  { key: 'ministry', label: 'Choir / Ministry', sw: 'Kwaya na Huduma', color: '#5b84b1' }
];

// ---------------------------------------------------------------- academics
export const ACADEMIC_LEVELS = [
  { value: 'certificate', label: 'Certificate (Astashahada)', short: 'Certificate' },
  { value: 'diploma', label: 'Diploma (Stashahada)', short: 'Diploma' },
  { value: 'degree', label: 'Bachelor Degree (Shahada)', short: 'Degree' }
];

// TIA Mbeya programmes by qualification level (tia.ac.tz).
// Keep in sync with coursesFor() in firestore.rules.
export const COURSES_BY_LEVEL = {
  certificate: [
    { code: 'BTCAC', name: 'Basic Technician Certificate in Accountancy' },
    { code: 'BTCPLM', name: 'Basic Technician Certificate in Procurement and Logistics Management' },
    { code: 'BTCBA', name: 'Basic Technician Certificate in Business Administration' },
    { code: 'BTCHRM', name: 'Basic Technician Certificate in Human Resource Management' },
    { code: 'BTCMK', name: 'Basic Technician Certificate in Marketing Management' },
    { code: 'BTCPSAF', name: 'Basic Technician Certificate in Public Sector Accounting and Finance' }
  ],
  diploma: [
    { code: 'DAC', name: 'Diploma in Accountancy' },
    { code: 'DPLM', name: 'Diploma in Procurement and Logistics Management' },
    { code: 'DBA', name: 'Diploma in Business Administration' },
    { code: 'DHRM', name: 'Diploma in Human Resource Management' },
    { code: 'DMK', name: 'Diploma in Marketing Management' },
    { code: 'DPSAF', name: 'Diploma in Public Sector Accounting and Finance' }
  ],
  degree: [
    { code: 'BAC', name: 'Bachelor in Accountancy' },
    { code: 'BPLM', name: 'Bachelor in Procurement and Logistics Management' },
    { code: 'BBA', name: 'Bachelor in Business Administration' },
    { code: 'BHRM', name: 'Bachelor in Human Resource Management' },
    { code: 'BMPR', name: 'Bachelor in Marketing and Public Relations' },
    { code: 'BPSAF', name: 'Bachelor in Public Sector Accounting and Finance' }
  ]
};

// Every course across all levels, each tagged with its level.
export const COURSES = Object.entries(COURSES_BY_LEVEL).flatMap(([level, courses]) =>
  courses.map((course) => ({ ...course, level }))
);

export const coursesForLevel = (level) => COURSES_BY_LEVEL[level] || [];

// Codes used by earlier versions of the registration form.
const LEGACY_COURSE_CODES = { BMA: 'BAC', BMK: 'BMPR' };

/** Course code for a profile's academicDetails, including legacy "Name (CODE)" strings. */
export function getCourseCode(academic) {
  if (academic?.courseCode) return academic.courseCode;
  const match = /\(([A-Z]+)\)\s*$/.exec(academic?.course || '');
  if (!match) return '';
  return LEGACY_COURSE_CODES[match[1]] || match[1];
}

export function getCourseName(academic) {
  const code = getCourseCode(academic);
  return COURSES.find((c) => c.code === code)?.name || academic?.course || '';
}

/** "BAC — Bachelor in Accountancy", or whatever was stored for unknown courses. */
export function formatCourse(academic) {
  const code = getCourseCode(academic);
  const name = getCourseName(academic);
  if (code && name) return `${code} — ${name}`;
  return name || code || '—';
}

/** Academic level value; inferred from the course for profiles created before levels existed. */
export function getAcademicLevel(academic) {
  if (academic?.level) return academic.level;
  const byCode = COURSES.find((c) => c.code === getCourseCode(academic))?.level;
  if (byCode) return byCode;
  return /^Bachelor/i.test(academic?.course || '') ? 'degree' : '';
}

export function formatAcademicLevel(value, { long = false } = {}) {
  const level = ACADEMIC_LEVELS.find((l) => l.value === value);
  if (!level) return '—';
  return long ? level.label : level.short;
}

export const formatYear = (value) => {
  if (!value) return '—';
  return value === 'N/A' ? 'N/A' : `Year ${value}`;
};

// ---------------------------------------------------------------- residence
// Areas surrounding the TIA campus, Mbeya Mjini.
export const RESIDENTIAL_AREAS = [
  'Mafiati (Karibu na Chuo)',
  'Simike',
  'Old Airport / Uwanja wa Ndege wa Zamani',
  'Iyunga',
  'Mwanjelwa',
  'Sisimba',
  'Block T',
  'Soweto',
  'Forest (New/Old)',
  'Meta',
  'Uzunguni',
  'Nzovwe',
  'Jacaranda',
  'Nonde'
];

// Earlier/free-text spellings mapped onto the official list.
const AREA_ALIASES = {
  mafiati: 'Mafiati (Karibu na Chuo)',
  forest: 'Forest (New/Old)',
  'old airport': 'Old Airport / Uwanja wa Ndege wa Zamani',
  'uwanja wa ndege': 'Old Airport / Uwanja wa Ndege wa Zamani'
};

const squash = (value = '') => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Maps any stored area string onto its official name (or a tidy version of itself). */
export function canonicalArea(raw) {
  const key = squash(raw);
  if (!key) return '';
  if (AREA_ALIASES[key]) return AREA_ALIASES[key];
  const official = RESIDENTIAL_AREAS.find((area) => squash(area) === key);
  if (official) return official;
  return titleCase(raw.trim().replace(/\s+/g, ' '));
}

export const HOUSE_NUMBER_MAX = 100;

/**
 * "House Number / Hostel Block". Profiles saved before the single-field schema may
 * also carry `roomNumber`; both are merged so no address detail is lost.
 */
export function getHouseNumber(location) {
  return [location?.houseNumber, location?.roomNumber]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');
}
