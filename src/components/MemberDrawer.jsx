import { useEffect, useId, useRef } from 'react';
import MemberAvatar from './MemberAvatar';
import {
  BookIcon,
  CloseIcon,
  HeartIcon,
  MapPinIcon,
  PhoneIcon,
  TrashIcon,
  UserIcon,
  WalletIcon
} from './Icons';
import {
  canonicalArea,
  formatAcademicLevel,
  formatRole,
  formatYear,
  getAcademicLevel,
  getCourseCode,
  getCourseName,
  getHouseNumber,
  isLeaderProfile
} from '../data/constants';
import { formatLongDate } from '../utils/format';

function Section({ icon, title, rows }) {
  return (
    <section className="drawer-section">
      <h3>
        {icon}
        {title}
      </h3>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Full member file in a right-hand side drawer (full-screen on phones).
 * Renders every registered field plus the Cloudinary profile photo.
 */
export default function MemberDrawer({
  member,
  isSelf,
  feeBusy,
  onToggleFee,
  onDelete,
  onClose,
  canDelete = false,
  suspendKeyboard = false
}) {
  const titleId = useId();
  const closeRef = useRef(null);
  const open = Boolean(member);

  // Focus, Esc-to-close and background scroll lock while open.
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || suspendKeyboard) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, suspendKeyboard, onClose]);

  if (!member) return null;

  const feePaid = member.membershipFeePaid === true;
  const isLeader = isLeaderProfile(member);
  const academic = member.academicDetails;
  const area = canonicalArea(member.location?.residentialArea || '');

  return (
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />

      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer-head">
          <span className="drawer-eyebrow">Member File</span>
          <button type="button" ref={closeRef} className="drawer-close" onClick={onClose} aria-label="Close member file">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-profile">
            <MemberAvatar name={member.fullName || member.email || ''} photoUrl={member.profilePictureUrl} size="xl" />
            <h2 id={titleId}>{member.fullName || 'Unnamed member'}</h2>
            <p className="drawer-email">{member.email}</p>
            <div className="drawer-badges">
              <span className={`badge ${isLeader ? 'badge-gold' : ''}`}>
                {formatRole(member)}
              </span>
              <span className={`badge ${feePaid ? 'badge-success' : 'badge-warning'}`}>
                {feePaid ? 'Fee Paid' : 'Fee Unpaid'}
              </span>
            </div>
            {member.profilePictureUrl ? (
              <a className="drawer-photo-link" href={member.profilePictureUrl} target="_blank" rel="noopener noreferrer">
                Open full-size photo
              </a>
            ) : (
              <span className="drawer-photo-none">No profile photo uploaded</span>
            )}
          </div>

          <div className="drawer-quick">
            {member.phone && (
              <a className="btn btn-outline btn-sm" href={`tel:${member.phone}`}>
                <PhoneIcon width={16} height={16} /> Call
              </a>
            )}
            {member.email && (
              <a className="btn btn-outline btn-sm" href={`mailto:${member.email}`}>
                <UserIcon width={16} height={16} /> Email
              </a>
            )}
          </div>

          <Section
            icon={<PhoneIcon width={16} height={16} />}
            title="Contact"
            rows={[
              { label: 'Full Name', value: member.fullName },
              { label: 'Email', value: member.email },
              { label: 'Phone', value: member.phone }
            ]}
          />

          <Section
            icon={<BookIcon width={16} height={16} />}
            title="Academic"
            rows={[
              { label: 'Qualification Level', value: formatAcademicLevel(getAcademicLevel(academic), { long: true }) },
              { label: 'Course Code', value: getCourseCode(academic) },
              { label: 'Course', value: getCourseName(academic) },
              { label: 'Year of Study', value: formatYear(academic?.yearOfStudy) }
            ]}
          />

          <Section
            icon={<MapPinIcon width={16} height={16} />}
            title="Residence (Mbeya Mjini)"
            rows={[
              { label: 'Residential Area', value: area },
              { label: 'House Number / Hostel Block', value: getHouseNumber(member.location) }
            ]}
          />

          <Section
            icon={<HeartIcon width={16} height={16} />}
            title="Church & Ministry"
            rows={[
              { label: 'Access Level', value: formatRole(member) },
              { label: 'Ministry Wing', value: member.ministryWing || 'None' },
              { label: 'Membership Fee', value: feePaid ? 'Paid' : 'Not yet paid' },
              { label: 'Fee Updated', value: member.feeUpdatedAt ? formatLongDate(member.feeUpdatedAt) : '' }
            ]}
          />

          <Section
            icon={<UserIcon width={16} height={16} />}
            title="Account"
            rows={[
              { label: 'Registered', value: formatLongDate(member.createdAt) },
              { label: 'Profile Updated', value: member.updatedAt ? formatLongDate(member.updatedAt) : '' },
              { label: 'Member ID', value: <code>{member.id}</code> }
            ]}
          />
        </div>

        <footer className="drawer-foot">
          <button
            type="button"
            className={`btn btn-sm ${feePaid ? 'btn-outline' : 'btn-approve'}`}
            onClick={onToggleFee}
            disabled={feeBusy || isSelf}
            title={isSelf ? 'Leaders cannot change their own fee status' : undefined}
          >
            {feeBusy ? <span className="spinner" /> : <WalletIcon width={16} height={16} />}
            {feePaid ? 'Mark Fee Unpaid' : 'Mark Fee Paid'}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onDelete}
            disabled={!canDelete}
            title={canDelete ? undefined : 'Leader accounts cannot be removed here'}
          >
            <TrashIcon width={16} height={16} />
            Delete Member
          </button>
        </footer>
      </aside>
    </div>
  );
}
