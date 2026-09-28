import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import AnnouncementPost from '../../components/AnnouncementPost';
import Alert from '../../components/Alert';
import {
  ArrowRightIcon,
  BookIcon,
  HeartIcon,
  MapPinIcon,
  MegaphoneIcon,
  PhoneIcon,
  ShieldIcon,
  UserIcon,
  WalletIcon
} from '../../components/Icons';
import {
  canonicalArea,
  formatAcademicLevel,
  formatCourse,
  formatRole,
  formatYear,
  getAcademicLevel,
  getHouseNumber
} from '../../data/constants';
import { formatLongDate } from '../../utils/format';

const ROLE_SUMMARY = {
  reader: 'You follow TUCASA TIA Mbeya programs and public announcements as part of our wider network.',
  member: 'You are an active student member of TUCASA TIA Mbeya with full fellowship access.',
  associate: 'You are connected as an alumni or supporter of the TUCASA TIA Mbeya fellowship.',
  leader: 'You serve on the TUCASA TIA Mbeya leadership team. Manage members and publish updates from the Command Center.'
};

export default function Overview() {
  const { userProfile, feedRole, isLeader, membershipFeePaid } = useAuth();
  const { announcements, status } = useRoleAnnouncements();

  const firstName = (userProfile?.fullName || '').split(' ')[0] || 'friend';
  const latest = announcements.slice(0, 3);
  const academic = userProfile?.academicDetails;
  const location = [canonicalArea(userProfile?.location?.residentialArea || ''), getHouseNumber(userProfile?.location)]
    .filter(Boolean)
    .join(' Â· ');

  const snapshot = [
    { icon: PhoneIcon, label: 'Phone', value: userProfile?.phone || 'â€”' },
    { icon: MapPinIcon, label: 'Residence', value: location || 'â€”' },
    { icon: BookIcon, label: 'Academic Level', value: formatAcademicLevel(getAcademicLevel(academic), { long: true }) },
    { icon: BookIcon, label: 'Course', value: formatCourse(academic) },
    { icon: BookIcon, label: 'Year of Study', value: formatYear(academic?.yearOfStudy) },
    { icon: HeartIcon, label: 'Ministry Wing', value: userProfile?.ministryWing || 'None' },
    { icon: WalletIcon, label: 'Membership Fee', value: membershipFeePaid ? 'Paid' : 'Not yet paid' },
    { icon: UserIcon, label: 'Member Since', value: formatLongDate(userProfile?.createdAt) }
  ];

  return (
    <div className="view">
      <section className="welcome-banner">
        <div>
          <span className="welcome-eyebrow">Member Workspace</span>
          <h2>Welcome back, {firstName}.</h2>
          <p>{ROLE_SUMMARY[isLeader ? 'leader' : feedRole] || ROLE_SUMMARY.member}</p>
        </div>
        <div className="welcome-badges">
          <span className="badge badge-gold">{formatRole(userProfile)}</span>
          <span className={`badge ${membershipFeePaid ? 'badge-success' : 'badge-warning'}`}>
            {membershipFeePaid ? 'Fee Paid' : 'Fee Unpaid'}
          </span>
        </div>
      </section>

      <section className="quick-grid">
        <Link to="/dashboard/announcements" className="quick-card">
          <span className="quick-icon"><MegaphoneIcon /></span>
          <span className="quick-text">
            <strong>Internal Announcements</strong>
            <small>
              {status === 'ready' ? `${announcements.length} post${announcements.length === 1 ? '' : 's'} for you` : 'Live fellowship updates'}
            </small>
          </span>
          <ArrowRightIcon width={18} height={18} className="quick-arrow" />
        </Link>

        <Link to="/dashboard/profile" className="quick-card">
          <span className="quick-icon"><MapPinIcon /></span>
          <span className="quick-text">
            <strong>Update My Location</strong>
            <small>Keep your housing current for welfare visits</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="quick-arrow" />
        </Link>

        {isLeader ? (
          <Link to="/leader" className="quick-card quick-card-gold">
            <span className="quick-icon"><ShieldIcon /></span>
            <span className="quick-text">
              <strong>Command Center</strong>
              <small>Registry, fees & analytics</small>
            </span>
            <ArrowRightIcon width={18} height={18} className="quick-arrow" />
          </Link>
        ) : (
          <Link to="/#ministries" className="quick-card">
            <span className="quick-icon"><HeartIcon /></span>
            <span className="quick-text">
              <strong>Choir & Ministries</strong>
              <small>Sabbath schedule and programs</small>
            </span>
            <ArrowRightIcon width={18} height={18} className="quick-arrow" />
          </Link>
        )}
      </section>

      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Latest Announcements</h3>
            <Link to="/dashboard/announcements" className="panel-link">
              View all <ArrowRightIcon width={15} height={15} />
            </Link>
          </div>

          {status === 'loading' && (
            <div className="panel-loading">
              <span className="spinner" />
              <span>Loading announcements...</span>
            </div>
          )}

          {status === 'error' && (
            <Alert type="error">We couldn't load announcements right now. Check your connection and try again.</Alert>
          )}

          {status === 'ready' && latest.length === 0 && (
            <div className="empty-state">
              <MegaphoneIcon width={26} height={26} />
              <p>No announcements for your group yet.</p>
            </div>
          )}

          {status === 'ready' && latest.length > 0 && (
            <div className="post-stack">
              {latest.map((item) => (
                <AnnouncementPost key={item.id} announcement={item} compact />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Profile Snapshot</h3>
            <Link to="/dashboard/profile" className="panel-link">
              Edit <ArrowRightIcon width={15} height={15} />
            </Link>
          </div>
          <dl className="snapshot-list">
            {snapshot.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="snapshot-row">
                  <span className="snapshot-icon"><Icon width={16} height={16} /></span>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>
    </div>
  );
}
