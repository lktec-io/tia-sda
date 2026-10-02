import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import useEngagement, { monthId, recentMonths } from '../hooks/useEngagement';
import EngagementChart from './charts/EngagementChart';
import { CheckIcon } from './Icons';
import { ENGAGEMENT_MAX, ENGAGEMENT_METRICS } from '../data/constants';
import { formatLongDate } from '../utils/format';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const valuesFrom = (record) =>
  Object.fromEntries(ENGAGEMENT_METRICS.map((m) => [m.key, record ? String(record[m.key] ?? 0) : '']));

/**
 * Leader tool inside the member drawer: record one month's attendance, welfare
 * meetings and choir/ministry service for a member (users/{uid}/engagement/{YYYY-MM}).
 * Keyed by member id by the parent, so state resets between members.
 */
export default function EngagementEditor({ memberId, memberName }) {
  const { currentUser } = useAuth();
  const { records, status, loadedAt } = useEngagement(memberId);

  const [pickedMonth, setPickedMonth] = useState('');
  const [draft, setDraft] = useState(null); // { month, values } — unsaved edits for one month
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState({ type: '', text: '' });

  const month = pickedMonth || (loadedAt ? monthId(new Date(loadedAt)) : '');
  const maxMonth = loadedAt ? monthId(new Date(loadedAt)) : undefined;
  const stored = records[month];
  const values = draft?.month === month ? draft.values : valuesFrom(stored);

  const setValue = (key, value) => {
    setDraft({ month, values: { ...values, [key]: value } });
    setNote({ type: '', text: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!MONTH_PATTERN.test(month)) {
      setNote({ type: 'error', text: 'Choose a valid month.' });
      return;
    }
    const counts = {};
    for (const metric of ENGAGEMENT_METRICS) {
      const n = Number(values[metric.key] || 0);
      if (!Number.isInteger(n) || n < 0 || n > ENGAGEMENT_MAX) {
        setNote({ type: 'error', text: `${metric.label} must be a whole number from 0 to ${ENGAGEMENT_MAX}.` });
        return;
      }
      counts[metric.key] = n;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'users', memberId, 'engagement', month), {
        month,
        ...counts,
        updatedBy: currentUser.uid,
        updatedAt: serverTimestamp()
      });
      setDraft(null);
      setNote({ type: 'success', text: `Saved ${month} for ${memberName || 'this member'}.` });
    } catch (error) {
      console.error('Engagement save error:', error);
      setNote({
        type: 'error',
        text:
          error?.code === 'permission-denied'
            ? 'Permission denied — deploy the latest firestore.rules.'
            : 'Could not save. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="engagement-editor">
      {status === 'ready' && <EngagementChart months={recentMonths(loadedAt, 6)} records={records} title={`Engagement for ${memberName}`} />}
      {status === 'error' && <p className="drawer-fee-note">Engagement history could not be loaded.</p>}

      <form className="engagement-form" onSubmit={handleSave}>
        <label className="engagement-field engagement-month">
          <span>Month</span>
          <input
            type="month"
            value={month}
            max={maxMonth}
            onChange={(e) => {
              setPickedMonth(e.target.value);
              setNote({ type: '', text: '' });
            }}
            required
          />
        </label>
        {ENGAGEMENT_METRICS.map((metric) => (
          <label key={metric.key} className="engagement-field">
            <span>
              <i className="engagement-key" style={{ background: metric.color }} aria-hidden="true" />
              {metric.label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max={ENGAGEMENT_MAX}
              step="1"
              placeholder="0"
              value={values[metric.key]}
              onChange={(e) => setValue(metric.key, e.target.value)}
            />
          </label>
        ))}
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || status !== 'ready'}>
          {saving ? <span className="spinner spinner-light" /> : <CheckIcon width={15} height={15} />}
          {stored ? 'Update Month' : 'Save Month'}
        </button>
      </form>

      <p className={`drawer-fee-note ${note.type === 'error' ? 'is-error' : ''}`} role="status">
        {note.text ||
          (stored?.updatedAt
            ? `${month} last recorded ${formatLongDate(stored.updatedAt)}.`
            : 'Counts per month (0–31): church attendance, welfare sessions, ministries/choir.')}
      </p>
    </div>
  );
}
