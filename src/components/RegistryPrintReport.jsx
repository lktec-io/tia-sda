import { LOGO_SRC } from './BrandLogo';
import { feeStatusInfo, formatRole, formatTZS, formatYear } from '../data/constants';
import { computeLedger } from '../lib/registry';
import '../styles/print.css';

/**
 * Print-only membership registry report (A4 landscape). Rendered into <body> by
 * useRegistryPrint just before window.print(); the print stylesheet hides the app
 * and shows only this document. "Save as PDF" in the print dialog produces the PDF.
 */
export default function RegistryPrintReport({ members, scope, generatedAt, onLogoSettled }) {
  const ledger = computeLedger(members);
  const generated = new Date(generatedAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <article className="print-report" aria-hidden="true">
      <header className="print-header">
        <img
          className="print-logo"
          src={LOGO_SRC}
          alt=""
          onLoad={onLogoSettled}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            onLogoSettled();
          }}
        />
        <p className="print-church">TIA SDA CHURCH · TUCASA TIA MBEYA</p>
        <h1 className="print-title">Membership Registry</h1>
        <p className="print-meta">
          {scope} · Generated {generated}
        </p>
      </header>

      <section className="print-summary">
        <div><span>Members</span><strong>{ledger.total}</strong></div>
        <div><span>Fully paid</span><strong>{ledger.fullyPaid}</strong></div>
        <div><span>Semester 1 paid</span><strong>{ledger.semesterPaid}</strong></div>
        <div><span>Unpaid</span><strong>{ledger.unpaid}</strong></div>
        <div><span>Collected</span><strong>{formatTZS(ledger.revenue)}</strong></div>
      </section>

      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Full Name</th>
            <th>Phone</th>
            <th>Access</th>
            <th>Course</th>
            <th>Year</th>
            <th>Residence</th>
            <th>Ministry</th>
            <th>Fee Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, index) => (
            <tr key={m.id}>
              <td>{index + 1}</td>
              <td>
                <strong>{m.fullName || '—'}</strong>
                <small>{m.email}</small>
              </td>
              <td>{m.phone || '—'}</td>
              <td>{formatRole(m)}</td>
              <td>{m.courseCode || m.courseName || '—'}</td>
              <td>{formatYear(m.academicDetails?.yearOfStudy)}</td>
              <td>
                {m.area || '—'}
                {m.houseNumber && <small>{m.houseNumber}</small>}
              </td>
              <td>{m.ministryWing || 'None'}</td>
              <td>{feeStatusInfo(m.feeStatus).label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="print-footer">
        Confidential — prepared for TUCASA TIA Mbeya leadership. Contains members&apos; personal contact details.
      </footer>
    </article>
  );
}
