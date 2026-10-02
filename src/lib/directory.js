// Flock Directory: the member-visible projection of a profile.
// Only these keys ever leave the leader-only `users` collection — phone, housing
// and fee status are deliberately absent (and rejected by firestore.rules).
import { getAcademicLevel, getCourseCode, getCourseName } from '../data/constants';

export const DIRECTORY_COLLECTION = 'directory';

/** Safe directory card fields for a `users/{uid}` profile (no timestamp). */
export const directoryEntryFrom = (profile) => ({
  uid: profile.uid,
  fullName: profile.fullName || '',
  profilePictureUrl: profile.profilePictureUrl || '',
  courseCode: getCourseCode(profile.academicDetails) || '',
  courseName: getCourseName(profile.academicDetails) || '',
  academicLevel: getAcademicLevel(profile.academicDetails) || '',
  ministryWing: profile.ministryWing || 'None'
});

const SYNC_KEYS = ['fullName', 'profilePictureUrl', 'courseCode', 'courseName', 'academicLevel', 'ministryWing'];

/** True when the stored entry already matches the profile (skip the write). */
export const isDirectoryEntryCurrent = (stored, entry) =>
  Boolean(stored) && SYNC_KEYS.every((key) => (stored[key] ?? '') === entry[key]);

/** A–Z bucket for the letter index ('#' for names that don't start with a letter). */
export const directoryLetter = (name = '') => {
  const first = name.trim().charAt(0).toUpperCase();
  return first >= 'A' && first <= 'Z' ? first : '#';
};

export const byName = (a, b) =>
  (a.fullName || '').localeCompare(b.fullName || '', 'en', { sensitivity: 'base' });
