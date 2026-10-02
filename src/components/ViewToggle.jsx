import { GridIcon, ListIcon } from './Icons';

const OPTIONS = [
  { value: 'list', label: 'List View', icon: ListIcon },
  { value: 'grid', label: 'Grid View', icon: GridIcon }
];

/**
 * Segmented "List View / Grid View" switch. `tone="dark"` for dark sections (homepage).
 */
export default function ViewToggle({ value, onChange, label = 'Layout', tone = 'light' }) {
  return (
    <div className={`view-toggle ${tone === 'dark' ? 'view-toggle-dark' : ''}`.trim()} role="group" aria-label={label}>
      {OPTIONS.map(({ value: option, label: text, icon: Icon }) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
          <Icon width={15} height={15} />
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}
