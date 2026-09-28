import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon, SearchIcon } from './Icons';
import '../styles/searchable-select.css';

/**
 * Accessible single-select dropdown. When there are more than `searchThreshold`
 * options, an inline filter box appears at the top of the list.
 * Keyboard: ↓/↑ move, Enter selects, Esc closes.
 */
export default function SearchableSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Type to filter...',
  emptyText = 'No matches found',
  required = false,
  searchThreshold = 5
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const filterRef = useRef(null);
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const showSearch = options.length > searchThreshold;

  const visibleOptions = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? options.filter((opt) => opt.toLowerCase().includes(term)) : options;
  }, [options, filter]);

  const openList = () => {
    const selectedIndex = options.indexOf(value);
    setFilter('');
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const closeList = (focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const selectOption = (option) => {
    onChange(option);
    closeList(true);
  };

  // Focus the filter (or the list) when opening.
  useEffect(() => {
    if (!open) return;
    if (showSearch) filterRef.current?.focus();
    else listRef.current?.focus();
  }, [open, showSearch]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const handleListKeys = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visibleOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleOptions[activeIndex]) selectOption(visibleOptions[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeList(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const handleTriggerKeys = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const activeOptionId = open && visibleOptions[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined;

  return (
    <div className={`ss ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`ss-trigger ${value ? '' : 'is-placeholder'}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeys}
      >
        <span className="ss-value">{value || placeholder}</span>
        <ChevronDownIcon width={18} height={18} className="ss-chevron" />
      </button>

      {/* Hidden native input so the browser's `required` validation still applies. */}
      <input
        className="ss-native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        onInvalid={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
          openList();
        }}
      />

      {open && (
        <div className="ss-panel">
          {showSearch && (
            <div className="ss-filter">
              <SearchIcon width={16} height={16} />
              <input
                ref={filterRef}
                type="text"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleListKeys}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={activeOptionId}
                autoComplete="off"
              />
            </div>
          )}

          <ul
            id={listId}
            ref={listRef}
            className="ss-list"
            role="listbox"
            tabIndex={showSearch ? -1 : 0}
            aria-activedescendant={showSearch ? undefined : activeOptionId}
            onKeyDown={showSearch ? undefined : handleListKeys}
          >
            {visibleOptions.length === 0 && <li className="ss-empty">{emptyText}</li>}
            {visibleOptions.map((option, index) => {
              const selected = option === value;
              return (
                <li
                  key={option}
                  id={`${listId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  className={`ss-option ${index === activeIndex ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span>{option}</span>
                  {selected && <CheckIcon width={16} height={16} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
