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
