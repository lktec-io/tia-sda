import { useState } from 'react';
import { deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/Alert';
import MemberAvatar from '../../components/MemberAvatar';
import SearchableSelect from '../../components/SearchableSelect';
import { LockIcon, MapPinIcon } from '../../components/Icons';
import {
  RESIDENTIAL_AREAS,
  canonicalArea,
  feeStatusInfo,
  getFeeStatus,
  formatAcademicLevel,
  formatCourse,
  formatRole,
  formatYear,
  getAcademicLevel,
  HOUSE_NUMBER_MAX,
  getHouseNumber
} from '../../data/constants';
import { formatLongDate } from '../../utils/format';

const PHONE_PATTERN = /^\+?[\d\s-]{9,16}$/;

const getSaveError = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'You do not have permission to change these details. Please contact the church secretary.';
    case 'unavailable':
      return 'Connection lost while saving. Please check your internet and try again.';
    case 'not-found':
      return 'Your member profile could not be found. Please contact the church leadership.';
    default:
      return 'Your changes could not be saved. Please try again.';
  }
};

const fromProfile = (profile) => ({
  phone: profile?.phone || '',
  // Older free-text areas (e.g. "Mafiati") are shown as their official name.
  residentialArea: canonicalArea(profile?.location?.residentialArea || ''),
  // Older profiles kept this in roomNumber; it is moved into houseNumber on save.
  houseNumber: getHouseNumber(profile?.location)
});

export default function MyProfile() {
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState(() => fromProfile(userProfile));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const saved = fromProfile(userProfile);
  const hasLegacyRoom = userProfile?.location?.roomNumber !== undefined;
  const isDirty =
    form.phone.trim() !== saved.phone ||
    form.residentialArea.trim() !== saved.residentialArea ||
    form.houseNumber.trim() !== saved.houseNumber;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (message.text) setMessage({ type: '', text: '' });
  };

  const handleDiscard = () => {
    setForm(fromProfile(userProfile));
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || !isDirty) return;

    const phone = form.phone.trim();
    const residentialArea = form.residentialArea.trim();
    const houseNumber = form.houseNumber.trim();

    if (!PHONE_PATTERN.test(phone)) {
      setMessage({ type: 'error', text: 'Enter a valid phone number, e.g. 0712345678 or +255712345678.' });
      return;
    }
    if (!residentialArea) {
      setMessage({ type: 'error', text: 'Your Mbeya residential area is required for welfare tracing.' });
      return;
    }

    setSaving(true);
    setMessage({ type: 'info', text: 'Saving your changes...' });

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        phone,
        'location.residentialArea': residentialArea,
        'location.houseNumber': houseNumber,
        // Single-field schema: retire the old roomNumber key.
        ...(hasLegacyRoom ? { 'location.roomNumber': deleteField() } : {}),
        updatedAt: serverTimestamp()
      });
      setForm({ phone, residentialArea, houseNumber });
      setMessage({ type: 'success', text: 'Your profile has been updated. The welfare team now has your current location.' });
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: getSaveError(error) });
    } finally {
      setSaving(false);
    }
  };

  const identity = [
    { label: 'Email', value: userProfile?.email || currentUser?.email },
    { label: 'Access Level', value: formatRole(userProfile) },
    { label: 'Academic Level', value: formatAcademicLevel(getAcademicLevel(userProfile?.academicDetails), { long: true }) },
    { label: 'Course', value: formatCourse(userProfile?.academicDetails) },
    { label: 'Year of Study', value: formatYear(userProfile?.academicDetails?.yearOfStudy) },
    { label: 'Ministry Wing', value: userProfile?.ministryWing || 'None' },
    { label: 'Membership Fee', value: feeStatusInfo(getFeeStatus(userProfile)).label },
    { label: 'Member Since', value: formatLongDate(userProfile?.createdAt) }
  ];

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>My Profile</h2>
          <p>Keep your contact and housing details current so the welfare team can reach you.</p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="profile-hero">
            <MemberAvatar
              name={userProfile?.fullName || ''}
              photoUrl={userProfile?.profilePictureUrl}
              size="lg"
              showStatus
            />
            <div>
              <h3>{userProfile?.fullName || 'Member'}</h3>
              <span className="badge badge-success">Active {formatRole(userProfile)}</span>
            </div>
          </div>

          <dl className="identity-list">
            {identity.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>

          <p className="profile-note">
            <LockIcon width={15} height={15} />
            Name, email, course, access level and membership fee status are managed by the church leadership.
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <MapPinIcon width={18} height={18} />
              Contact & Housing
            </h3>
            {isDirty && <span className="badge badge-warning">Unsaved changes</span>}
          </div>

          {message.text && <Alert type={message.type}>{message.text}</Alert>}

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="field">
              <label htmlFor="profile-phone">Phone Number</label>
              <input
                id="profile-phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 0712345678"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="profile-area">Mbeya Residential Area</label>
              <SearchableSelect
                id="profile-area"
                name="residentialArea"
                value={form.residentialArea}
                onChange={(value) => handleChange({ target: { name: 'residentialArea', value } })}
                options={RESIDENTIAL_AREAS}
                placeholder="Select your area"
                searchPlaceholder="Search areas..."
                emptyText="No area matches your search"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="profile-house">House Number / Hostel Block</label>
              <input
                id="profile-house"
                type="text"
                name="houseNumber"
                value={form.houseNumber}
                onChange={handleChange}
                maxLength={HOUSE_NUMBER_MAX}
                placeholder="e.g. Nyumba Na. 23 or Hostel Block B, Room 12"
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={handleDiscard} disabled={!isDirty || saving}>
                Discard
              </button>
              <button type="submit" className="btn btn-primary" disabled={!isDirty || saving}>
                {saving ? (
                  <>
                    <span className="spinner spinner-light" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
