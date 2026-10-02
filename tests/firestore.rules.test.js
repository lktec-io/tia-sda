// Firestore security rules test suite.
// Run with:  npm run test:rules
// (Starts the Firestore emulator, runs these tests with node --test, then shuts it down.)

import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

const PROJECT_ID = 'demo-tucasa-rules';
const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/tucasa/profile.jpg';

let env;

// Profiles as stored by EARLIER versions (legacy course string + roomNumber).
const legacyProfile = (uid, role, extra = {}) => ({
  uid,
  fullName: `${uid} Test`,
  email: `${uid}@example.com`,
  phone: '0712345678',
  role,
  membershipFeePaid: false,
  profilePictureUrl: '',
  academicDetails: { yearOfStudy: '2', course: 'Bachelor in Accountancy (BMA)' },
  location: { residentialArea: 'Mafiati', roomNumber: 'B12' },
  ministryWing: 'None',
  createdAt: new Date('2026-01-01'),
  ...extra
});

// Exactly what the current Registration.jsx writes.
const registration = (uid, extra = {}) => ({
  uid,
  fullName: `${uid} Test`,
  email: `${uid}@example.com`,
  phone: '0712345678',
  role: 'member',
  membershipFeePaid: false,
  profilePictureUrl: '',
  academicDetails: { level: 'degree', courseCode: 'BAC', course: 'Bachelor in Accountancy', yearOfStudy: '2' },
  location: { residentialArea: 'Mafiati (Karibu na Chuo)', houseNumber: 'Hostel Block B, Room 12' },
  ministryWing: 'None',
  createdAt: serverTimestamp(),
  ...extra
});

const academic = (level, courseCode) => ({ level, courseCode, course: courseCode, yearOfStudy: '1' });

const post = (authorId, visibleTo, extra = {}) => ({
  title: 'Combined Sabbath Service',
  category: 'Sabbath Service',
  content: 'All members are welcome.',
  visibleTo,
  authorId,
  authorName: 'Leader Test',
  publishedAt: serverTimestamp(),
  ...extra
});

const asGuest = () => env.unauthenticatedContext().firestore();
const as = (uid) => env.authenticatedContext(uid).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // leader1: older leader profile without a status; leader2: current shape (status 'approved').
    await setDoc(doc(db, 'users/leader1'), legacyProfile('leader1', 'leader', { membershipFeePaid: true }));
    await setDoc(doc(db, 'users/leader2'), legacyProfile('leader2', 'leader', { status: 'approved' }));
    await setDoc(doc(db, 'users/member1'), legacyProfile('member1', 'member'));
    await setDoc(doc(db, 'users/member2'), legacyProfile('member2', 'member'));
    await setDoc(doc(db, 'users/assoc1'), legacyProfile('assoc1', 'associate'));

    const published = { publishedAt: new Date('2026-02-01') };
    await setDoc(doc(db, 'announcements/public'), { ...post('leader1', ['reader', 'member']), ...published });
    await setDoc(doc(db, 'announcements/membersOnly'), { ...post('leader1', ['member']), ...published });
    await setDoc(doc(db, 'announcements/associatesOnly'), { ...post('leader1', ['associate']), ...published });
  });
});

// ---------------------------------------------------------------------------
describe('Public announcements (Home page)', () => {
  test('guest can query announcements tagged reader', async () => {
    const q = query(collection(asGuest(), 'announcements'), where('visibleTo', 'array-contains', 'reader'));
    await assertSucceeds(getDocs(q));
  });

  test('guest cannot list the whole collection', async () => {
    await assertFails(getDocs(collection(asGuest(), 'announcements')));
  });

  test('guest cannot query member announcements', async () => {
    const q = query(collection(asGuest(), 'announcements'), where('visibleTo', 'array-contains', 'member'));
    await assertFails(getDocs(q));
  });
});

// ---------------------------------------------------------------------------
describe('Internal announcements (member portal feed)', () => {
  test('member can run the member feed query', async () => {
    const q = query(collection(as('member1'), 'announcements'), where('visibleTo', 'array-contains', 'member'));
    await assertSucceeds(getDocs(q));
  });

  test('associate can run the associate feed query', async () => {
    const q = query(collection(as('assoc1'), 'announcements'), where('visibleTo', 'array-contains', 'associate'));
    await assertSucceeds(getDocs(q));
  });

  test('member cannot query associate-only announcements', async () => {
    const q = query(collection(as('member1'), 'announcements'), where('visibleTo', 'array-contains', 'associate'));
    await assertFails(getDocs(q));
  });

  test('member cannot read ALL announcements', async () => {
    await assertFails(getDocs(collection(as('member1'), 'announcements')));
  });

  test('leader (with or without a status field) can read every announcement', async () => {
    await assertSucceeds(getDocs(collection(as('leader1'), 'announcements')));
    await assertSucceeds(getDocs(collection(as('leader2'), 'announcements')));
  });
});

// ---------------------------------------------------------------------------
describe('Registration', () => {
  test('member registration (no status) succeeds', async () => {
    await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie'), registration('newbie')));
  });

  test('leader registration (status approved) succeeds and grants access immediately', async () => {
    await assertSucceeds(
      setDoc(doc(as('newLeader'), 'users/newLeader'), registration('newLeader', { role: 'leader', status: 'approved' }))
    );
    await assertSucceeds(getDocs(collection(as('newLeader'), 'users')));
  });

  test('leader registration without status approved is rejected', async () => {
    await assertFails(setDoc(doc(as('a'), 'users/a'), registration('a', { role: 'leader' })));
    await assertFails(setDoc(doc(as('b'), 'users/b'), registration('b', { role: 'leader', status: 'pending' })));
  });

  test('the passcode is never stored on the profile', async () => {
    await assertFails(
      setDoc(doc(as('c'), 'users/c'), registration('c', { role: 'leader', status: 'approved', leaderPasscode: 'x' }))
    );
  });

  test('an existing member cannot upgrade themselves to leader', async () => {
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), { role: 'leader', status: 'approved' }));
  });

  test('non-leaders cannot carry a status', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), registration('newbie', { status: 'approved' })));
  });

  test('Cloudinary profile photo is accepted; other hosts are rejected', async () => {
    await assertSucceeds(setDoc(doc(as('a'), 'users/a'), registration('a', { profilePictureUrl: PHOTO })));
    await assertFails(setDoc(doc(as('b'), 'users/b'), registration('b', { profilePictureUrl: 'https://evil.example.com/x.jpg' })));
  });

  test('nobody can register as already paid', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/newbie'), registration('newbie', { membershipFeePaid: true })));
  });

  test('certificate + BTC course and diploma + D course are accepted', async () => {
    await assertSucceeds(setDoc(doc(as('c'), 'users/c'), registration('c', { academicDetails: academic('certificate', 'BTCPLM') })));
    await assertSucceeds(setDoc(doc(as('d'), 'users/d'), registration('d', { academicDetails: academic('diploma', 'DMK') })));
  });

  test('course code must belong to the chosen level', async () => {
    await assertFails(setDoc(doc(as('c'), 'users/c'), registration('c', { academicDetails: academic('certificate', 'BAC') })));
    await assertFails(setDoc(doc(as('d'), 'users/d'), registration('d', { academicDetails: academic('degree', 'DAC') })));
  });

  test('retired codes (BMA, BMK) and unknown levels are rejected', async () => {
    await assertFails(setDoc(doc(as('a'), 'users/a'), registration('a', { academicDetails: academic('degree', 'BMA') })));
    await assertFails(setDoc(doc(as('b'), 'users/b'), registration('b', { academicDetails: academic('masters', 'BAC') })));
  });

  test('roomNumber is no longer accepted at registration', async () => {
    await assertFails(
      setDoc(doc(as('newbie'), 'users/newbie'), registration('newbie', {
        location: { residentialArea: 'Iyunga', houseNumber: '1', roomNumber: '2' }
      }))
    );
  });

  test('cannot create a profile for another uid', async () => {
    await assertFails(setDoc(doc(as('newbie'), 'users/someoneElse'), registration('someoneElse')));
  });
});

// ---------------------------------------------------------------------------
describe('Profiles: self access', () => {
  test('user can read own profile but not another', async () => {
    await assertSucceeds(getDoc(doc(as('member1'), 'users/member1')));
    await assertFails(getDoc(doc(as('member1'), 'users/assoc1')));
  });

  test('member cannot list the user registry', async () => {
    await assertFails(getDocs(collection(as('member1'), 'users')));
  });

  test('My Profile save: houseNumber set and legacy roomNumber removed', async () => {
    await assertSucceeds(
      updateDoc(doc(as('member1'), 'users/member1'), {
        phone: '0755000111',
        'location.residentialArea': 'Iyunga',
        'location.houseNumber': 'Nyumba Na. 23',
        'location.roomNumber': deleteField(),
        updatedAt: serverTimestamp()
      })
    );
  });

  test('location edit that keeps roomNumber is rejected', async () => {
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), { 'location.houseNumber': 'Nyumba Na. 23' }));
  });

  test('phone-only update works on a legacy profile', async () => {
    await assertSucceeds(updateDoc(doc(as('member1'), 'users/member1'), { phone: '0766000222' }));
  });

  test('house number is limited to 100 characters', async () => {
    await assertFails(
      updateDoc(doc(as('member1'), 'users/member1'), {
        'location.houseNumber': 'x'.repeat(101),
        'location.roomNumber': deleteField()
      })
    );
  });

  test('member cannot change academics, fee or role', async () => {
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), { 'academicDetails.level': 'degree' }));
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), { membershipFeePaid: true }));
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), { role: 'leader' }));
  });

  test('member cannot make themselves a leader after registering', async () => {
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), { role: 'leader', status: 'approved' }));
  });

  test('user cannot delete their own profile', async () => {
    await assertFails(deleteDoc(doc(as('member1'), 'users/member1')));
  });
});

// ---------------------------------------------------------------------------
describe('Semester fee ledger (feeStatus)', () => {
  const feeUpdate = (status, by = 'leader1') => ({
    feeStatus: status,
    membershipFeePaid: status === 'fully_paid',
    feeUpdatedBy: by,
    feeUpdatedAt: serverTimestamp()
  });

  test('registration may include feeStatus unpaid, but never a paid state', async () => {
    await assertSucceeds(setDoc(doc(as('a'), 'users/a'), registration('a', { feeStatus: 'unpaid' })));
    await assertFails(setDoc(doc(as('b'), 'users/b'), registration('b', { feeStatus: 'semester1_paid' })));
  });

  test('leader can set Semester 1 Paid and Fully Paid with an audit trail', async () => {
    await assertSucceeds(updateDoc(doc(as('leader1'), 'users/member1'), feeUpdate('semester1_paid')));
    await assertSucceeds(updateDoc(doc(as('leader1'), 'users/member1'), feeUpdate('fully_paid')));
    await assertSucceeds(updateDoc(doc(as('leader1'), 'users/member1'), feeUpdate('unpaid')));
  });

  test('unknown status, mismatched legacy flag or missing audit is rejected', async () => {
    await assertFails(updateDoc(doc(as('leader1'), 'users/member1'), feeUpdate('half_paid')));
    await assertFails(
      updateDoc(doc(as('leader1'), 'users/member1'), { ...feeUpdate('semester1_paid'), membershipFeePaid: true })
    );
    await assertFails(updateDoc(doc(as('leader1'), 'users/member1'), { feeStatus: 'fully_paid', membershipFeePaid: true }));
  });

  test('member cannot change their own feeStatus', async () => {
    await assertFails(updateDoc(doc(as('member1'), 'users/member1'), feeUpdate('fully_paid', 'member1')));
  });
});

describe('Leadership Command Center', () => {
  test('leader can list the full registry', async () => {
    await assertSucceeds(getDocs(collection(as('leader1'), 'users')));
  });

  test('leader can mark a member fee as paid with an audit trail', async () => {
    await assertSucceeds(
      updateDoc(doc(as('leader1'), 'users/member1'), {
        membershipFeePaid: true,
        feeUpdatedBy: 'leader1',
        feeUpdatedAt: serverTimestamp()
      })
    );
  });

  test('fee change without audit fields is rejected', async () => {
    await assertFails(updateDoc(doc(as('leader1'), 'users/member1'), { membershipFeePaid: true }));
  });

  test('leader cannot change their own fee, role or status', async () => {
    await assertFails(
      updateDoc(doc(as('leader2'), 'users/leader2'), {
        membershipFeePaid: true,
        feeUpdatedBy: 'leader2',
        feeUpdatedAt: serverTimestamp()
      })
    );
    await assertFails(updateDoc(doc(as('leader1'), 'users/leader1'), { role: 'member' }));
    await assertFails(updateDoc(doc(as('leader2'), 'users/leader2'), { status: 'pending' }));
  });

  test('leader cannot rewrite a member email', async () => {
    await assertFails(updateDoc(doc(as('leader1'), 'users/member1'), { email: 'x@example.com' }));
  });

  test('leader can delete a member', async () => {
    await assertSucceeds(deleteDoc(doc(as('leader1'), 'users/member1')));
  });

  test('leader cannot delete themselves or another leader', async () => {
    await assertFails(deleteDoc(doc(as('leader1'), 'users/leader1')));
    await assertFails(deleteDoc(doc(as('leader1'), 'users/leader2')));
  });
});

// ---------------------------------------------------------------------------
describe('Announcement posters & Edit Mode', () => {
  test('leader can publish with a Cloudinary poster', async () => {
    await assertSucceeds(addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['reader'], { imageUrl: PHOTO })));
  });

  test('poster must be hosted on Cloudinary', async () => {
    await assertFails(
      addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['reader'], { imageUrl: 'https://evil.example.com/x.jpg' }))
    );
  });

  test('leader can edit content and poster, stamped with updatedBy/updatedAt', async () => {
    await assertSucceeds(
      updateDoc(doc(as('leader2'), 'announcements/public'), {
        title: 'Updated title',
        imageUrl: PHOTO,
        updatedBy: 'leader2',
        updatedAt: serverTimestamp()
      })
    );
  });

  test('edit cannot forge updatedBy or change the original author/date', async () => {
    await assertFails(updateDoc(doc(as('leader2'), 'announcements/public'), { updatedBy: 'leader1' }));
    await assertFails(updateDoc(doc(as('leader2'), 'announcements/public'), { authorName: 'Someone else' }));
    await assertFails(updateDoc(doc(as('leader2'), 'announcements/public'), { publishedAt: new Date('2020-01-01') }));
  });

  test('member cannot edit an announcement', async () => {
    await assertFails(updateDoc(doc(as('member1'), 'announcements/public'), { title: 'Hacked' }));
  });
});

describe('Announcement publishing', () => {
  test('leader can publish under their own uid', async () => {
    await assertSucceeds(addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['member', 'associate'])));
  });

  test('leader cannot publish under another uid or backdate', async () => {
    await assertFails(addDoc(collection(as('leader1'), 'announcements'), post('member1', ['member'])));
    await assertFails(
      addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['member'], { publishedAt: new Date('2020-01-01') }))
    );
  });

  test('audience must be non-empty and known', async () => {
    await assertFails(addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['everyone'])));
    await assertFails(addDoc(collection(as('leader1'), 'announcements'), post('leader1', [])));
  });

  test('member and guest cannot publish', async () => {
    await assertFails(addDoc(collection(as('member1'), 'announcements'), post('member1', ['member'])));
    await assertFails(addDoc(collection(asGuest(), 'announcements'), post('guest', ['reader'])));
  });

  test('leader can delete an announcement; member cannot', async () => {
    await assertFails(deleteDoc(doc(as('member1'), 'announcements/public')));
    await assertSucceeds(deleteDoc(doc(as('leader1'), 'announcements/public')));
  });
});

describe('Announcement scheduling (scheduledAt / expiresAt)', () => {
  test('leader can publish with a schedule window', async () => {
    await assertSucceeds(
      addDoc(
        collection(as('leader1'), 'announcements'),
        post('leader1', ['member'], { scheduledAt: new Date('2026-11-01T08:00'), expiresAt: new Date('2026-11-08T08:00') })
      )
    );
  });

  test('expiry must be after the schedule, and both must be timestamps', async () => {
    await assertFails(
      addDoc(
        collection(as('leader1'), 'announcements'),
        post('leader1', ['member'], { scheduledAt: new Date('2026-11-08'), expiresAt: new Date('2026-11-01') })
      )
    );
    await assertFails(addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['member'], { expiresAt: '2026-11-08' })));
  });

  test('edit can set and then clear the schedule fields', async () => {
    const ref = doc(as('leader2'), 'announcements/public');
    await assertSucceeds(updateDoc(ref, { expiresAt: new Date('2026-12-01'), updatedBy: 'leader2', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { expiresAt: deleteField(), updatedBy: 'leader2', updatedAt: serverTimestamp() }));
  });
});

describe('Flock Directory', () => {
  // Matches legacyProfile('member1'): name `${uid} Test`, no photo.
  const card = (uid, extra = {}) => ({
    uid,
    fullName: `${uid} Test`,
    profilePictureUrl: '',
    courseCode: 'BAC',
    courseName: 'Bachelor in Accountancy',
    academicLevel: 'degree',
    ministryWing: 'None',
    updatedAt: serverTimestamp(),
    ...extra
  });

  test('member can publish their own card and any profile holder can browse', async () => {
    await assertSucceeds(setDoc(doc(as('member1'), 'directory/member1'), card('member1')));
    await assertSucceeds(getDocs(collection(as('member2'), 'directory')));
    await assertSucceeds(getDocs(collection(as('assoc1'), 'directory')));
  });

  test('guests and accounts without a profile cannot browse', async () => {
    await assertFails(getDocs(collection(asGuest(), 'directory')));
    await assertFails(getDocs(collection(as('ghost'), 'directory')));
  });

  test('sensitive fields (phone, house, fee) can never be written to a card', async () => {
    await assertFails(setDoc(doc(as('member1'), 'directory/member1'), card('member1', { phone: '0712345678' })));
    await assertFails(setDoc(doc(as('member1'), 'directory/member1'), card('member1', { houseNumber: 'B12' })));
    await assertFails(setDoc(doc(as('member1'), 'directory/member1'), card('member1', { feeStatus: 'fully_paid' })));
  });

  test('name and photo must mirror the profile; no cards for other users', async () => {
    await assertFails(setDoc(doc(as('member1'), 'directory/member1'), card('member1', { fullName: 'Someone Else' })));
    await assertFails(setDoc(doc(as('member1'), 'directory/member1'), card('member1', { profilePictureUrl: PHOTO })));
    await assertFails(setDoc(doc(as('member1'), 'directory/member2'), card('member2')));
  });

  test('a new registration can write profile + card in one batch', async () => {
    const db = as('newbie');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/newbie'), registration('newbie'));
    batch.set(doc(db, 'directory/newbie'), card('newbie'));
    await assertSucceeds(batch.commit());
  });

  test('leader can remove a member together with their card', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'directory/member1'), card('member1', { updatedAt: new Date() }));
    });
    const db = as('leader1');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users/member1'));
    batch.delete(doc(db, 'directory/member1'));
    await assertSucceeds(batch.commit());
  });
});

describe('Engagement analytics (users/{uid}/engagement/{YYYY-MM})', () => {
  const record = (month, extra = {}) => ({
    month,
    attendance: 4,
    welfare: 1,
    ministry: 3,
    updatedBy: 'leader1',
    updatedAt: serverTimestamp(),
    ...extra
  });

  test('leader can record a month; the member can read their own history', async () => {
    await assertSucceeds(setDoc(doc(as('leader1'), 'users/member1/engagement/2026-10'), record('2026-10')));
    await assertSucceeds(getDocs(collection(as('member1'), 'users/member1/engagement')));
  });

  test('members cannot read others or write their own counts', async () => {
    await assertFails(getDocs(collection(as('member2'), 'users/member1/engagement')));
    await assertFails(
      setDoc(doc(as('member1'), 'users/member1/engagement/2026-10'), record('2026-10', { updatedBy: 'member1' }))
    );
  });

  test('month id, ranges and audit fields are validated', async () => {
    const leader = as('leader1');
    await assertFails(setDoc(doc(leader, 'users/member1/engagement/2026-13'), record('2026-13')));
    await assertFails(setDoc(doc(leader, 'users/member1/engagement/2026-10'), record('2026-09')));
    await assertFails(setDoc(doc(leader, 'users/member1/engagement/2026-10'), record('2026-10', { attendance: 40 })));
    await assertFails(setDoc(doc(leader, 'users/member1/engagement/2026-10'), record('2026-10', { welfare: 1.5 })));
    await assertFails(setDoc(doc(leader, 'users/member1/engagement/2026-10'), record('2026-10', { updatedBy: 'leader2' })));
    await assertFails(setDoc(doc(leader, 'users/member1/engagement/2026-10'), record('2026-10', { phone: '07' })));
  });
});

describe('Worship duty roster (worshipSchedules/{YYYY-MM-DD})', () => {
  const SABBATH = '2026-10-03'; // a Saturday
  const roster = (sabatoDate, extra = {}) => ({
    sabatoDate,
    midweek: { wednesdayPrayer: 'Neema J.', fridayVespers: 'Daudi K.' },
    sabbathSchool: { chair: 'Rehema M.', memoryVerse: 'Zaburi 23:1', missionStory: 'Peter L.', lessonStudy: 'Asha N.' },
    divineService: { chair: 'John P.', mainScripture: 'Yohana 3:16', preacher: 'Pr. Mwakalinga', offering: 'Grace T.' },
    createdBy: 'leader1',
    createdByName: 'Leader Test',
    createdAt: serverTimestamp(),
    ...extra
  });

  test('leader can publish a Sabbath roster; members and associates can read it', async () => {
    await assertSucceeds(setDoc(doc(as('leader1'), `worshipSchedules/${SABBATH}`), roster(SABBATH)));
    await assertSucceeds(getDocs(query(collection(as('member1'), 'worshipSchedules'))));
    await assertSucceeds(getDoc(doc(as('assoc1'), `worshipSchedules/${SABBATH}`)));
  });

  test('guests cannot read the roster; members cannot write it', async () => {
    await assertFails(getDocs(collection(asGuest(), 'worshipSchedules')));
    await assertFails(setDoc(doc(as('member1'), `worshipSchedules/${SABBATH}`), roster(SABBATH, { createdBy: 'member1' })));
  });

  test('the document id must be a Saturday matching sabatoDate', async () => {
    await assertFails(setDoc(doc(as('leader1'), 'worshipSchedules/2026-10-04'), roster('2026-10-04'))); // Sunday
    await assertFails(setDoc(doc(as('leader1'), `worshipSchedules/${SABBATH}`), roster('2026-10-10')));
  });

  test('unknown duty keys and over-long values are rejected', async () => {
    await assertFails(
      setDoc(doc(as('leader1'), `worshipSchedules/${SABBATH}`), roster(SABBATH, { midweek: { wednesdayPrayer: 'A', extra: 'B' } }))
    );
    await assertFails(
      setDoc(
        doc(as('leader1'), `worshipSchedules/${SABBATH}`),
        roster(SABBATH, { divineService: { chair: 'x'.repeat(121), mainScripture: '', preacher: '', offering: '' } })
      )
    );
  });

  test('leader edits are stamped; author and date are immutable; leader can delete', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `worshipSchedules/${SABBATH}`), roster(SABBATH, { createdAt: new Date() }));
    });
    const ref = doc(as('leader2'), `worshipSchedules/${SABBATH}`);
    await assertSucceeds(
      updateDoc(ref, {
        divineService: { chair: 'John P.', mainScripture: 'Yohana 3:16', preacher: 'Pr. Kibona', offering: 'Grace T.' },
        updatedBy: 'leader2',
        updatedAt: serverTimestamp()
      })
    );
    await assertFails(updateDoc(ref, { createdBy: 'leader2', updatedBy: 'leader2', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { updatedBy: 'leader1', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });
});

describe('Announcement source authority & event date', () => {
  test('leader can publish with an issuing office and an event date', async () => {
    await assertSucceeds(
      addDoc(
        collection(as('leader1'), 'announcements'),
        post('leader1', ['member'], { issuedBy: 'Katibu / Church Secretary', eventDate: new Date('2026-10-10T12:00') })
      )
    );
    await assertSucceeds(
      addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['member'], { issuedBy: 'Idara ya Muziki/Kwaya' }))
    );
  });

  test('unknown offices and non-timestamp event dates are rejected', async () => {
    await assertFails(addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['member'], { issuedBy: 'Pastor Bob' })));
    await assertFails(addDoc(collection(as('leader1'), 'announcements'), post('leader1', ['member'], { eventDate: '2026-10-10' })));
  });

  test('edit can add, change and clear the event date', async () => {
    const ref = doc(as('leader2'), 'announcements/public');
    const stamp = { updatedBy: 'leader2', updatedAt: serverTimestamp() };
    await assertSucceeds(updateDoc(ref, { issuedBy: 'Hazina (Treasurer)', eventDate: new Date('2026-11-01'), ...stamp }));
    await assertSucceeds(updateDoc(ref, { eventDate: deleteField(), ...stamp }));
  });
});
