// Shared member-registry logic used by the Command Center and the Executive Overview,
// so both always show identical figures and export identical CSV files.
import {
  FEE_ANNUAL_TZS,
  FEE_PER_SEMESTER_TZS,
  canonicalArea,
  feeStatusInfo,
  formatAcademicLevel,
  formatRole,
  formatYear,
  getAcademicLevel,
  getCourseCode,
  getCourseName,
  getFeeStatus,
  getHouseNumber
} from '../data/constants';
import { buildCsv, downloadCsv } from '../utils/csv';
import { toDate } from '../utils/format';

/** Normalised view of a profile: legacy courses/areas/fees mapped onto official values. */
export const enrichMember = (u) => ({
  ...u,
  academicLevel: getAcademicLevel(u.academicDetails),
  courseCode: getCourseCode(u.academicDetails),
  courseName: getCourseName(u.academicDetails),
  area: canonicalArea(u.location?.residentialArea || ''),
  houseNumber: getHouseNumber(u.location),
  feeStatus: getFeeStatus(u)
});

/** Treasury ledger: 2,500 TZS per Semester-1 payer + 5,000 TZS per fully paid member. */
export function computeLedger(members) {
  const fullyPaid = members.filter((u) => u.feeStatus === 'fully_paid').length;
  const semesterPaid = members.filter((u) => u.feeStatus === 'semester1_paid').length;
  const unpaid = members.length - fullyPaid - semesterPaid;
  const revenue = semesterPaid * FEE_PER_SEMESTER_TZS + fullyPaid * FEE_ANNUAL_TZS;
  const potential = members.length * FEE_ANNUAL_TZS;
  return { total: members.length, fullyPaid, semesterPaid, unpaid, revenue, potential, outstanding: potential - revenue };
}

/**
 * Membership growth for the last `months` calendar months ending at `endMs`:
 * [{ label: 'Mar', added, total }]. Profiles without a createdAt count as existing
 * before the window (they add to `total` but not to `added`).
 */
export function membershipGrowth(members, endMs, months = 6) {
  if (!endMs) return [];
  const end = new Date(endMs);
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const next = new Date(end.getFullYear(), end.getMonth() - i + 1, 1);
    buckets.push({ start: start.getTime(), next: next.getTime(), label: start.toLocaleDateString('en-GB', { month: 'short' }) });
  }

  const joinTimes = members.map((m) => toDate(m.createdAt)?.getTime() ?? -Infinity);
  return buckets.map((b) => ({
    label: b.label,
    added: joinTimes.filter((t) => t >= b.start && t < b.next).length,
    total: joinTimes.filter((t) => t < b.next).length
  }));
}

const isoDate = (value) => {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

// Every field collected at registration (rows must be enriched first).
export const REGISTRY_CSV_COLUMNS = [
  { header: 'Full Name', value: (u) => u.fullName },
  { header: 'Email', value: (u) => u.email },
  { header: 'Phone', value: (u) => u.phone },
  { header: 'Access Level', value: (u) => formatRole(u) },
  { header: 'Membership Fee Status', value: (u) => feeStatusInfo(u.feeStatus).label },
  { header: 'Fee Paid (TZS)', value: (u) => feeStatusInfo(u.feeStatus).amount },
  { header: 'Academic Level', value: (u) => (u.academicLevel ? formatAcademicLevel(u.academicLevel, { long: true }) : '') },
  { header: 'Course Code', value: (u) => u.courseCode },
  { header: 'Course Name', value: (u) => u.courseName },
  { header: 'Year of Study', value: (u) => formatYear(u.academicDetails?.yearOfStudy) },
  { header: 'Residential Area', value: (u) => u.area },
  { header: 'House Number / Hostel Block', value: (u) => u.houseNumber },
  { header: 'Ministry Wing', value: (u) => u.ministryWing || 'None' },
  { header: 'Registered On', value: (u) => isoDate(u.createdAt) },
  { header: 'Profile Picture URL', value: (u) => u.profilePictureUrl },
  { header: 'Member ID', value: (u) => u.id }
];

/** Downloads the given (enriched) members as a dated CSV file. Returns the row count. */
export function exportRegistryCsv(members, filePrefix = 'tucasa-tia-mbeya-registry') {
  if (!members.length) return 0;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`${filePrefix}-${stamp}.csv`, buildCsv(members, REGISTRY_CSV_COLUMNS));
  return members.length;
}

export const getRegistryError = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'Permission denied by the database rules. If this is a leader account, the latest firestore.rules may not be deployed yet — see the browser console for details.';
    case 'unavailable':
      return 'Connection to the database was lost. Changes will sync once you are back online.';
    case 'not-found':
      return 'That member no longer exists in the registry.';
    default:
      return 'A database error occurred. Please try again.';
  }
};
