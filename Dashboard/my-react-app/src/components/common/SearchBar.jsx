import { useEffect, useRef } from 'react';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';

const SearchBar = ({ open, value, placeholder, onToggle, onChange, onSearch, className = '' }) => {
  const timerRef = useRef(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (!open) {
      previousValueRef.current = value;
      return undefined;
    }

    if (previousValueRef.current === value) {
      return undefined;
    }

    previousValueRef.current = value;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      onSearch?.();
    }, 300);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [onSearch, open, value]);

  return (
    <div className={`search-bar-shell ${open ? 'open' : ''} ${className}`.trim()}>
      <button type="button" className="toolbar-button icon-only search-toggle" onClick={onToggle} aria-expanded={open} aria-label={placeholder} title={placeholder}>
        <HiOutlineMagnifyingGlass />
        <span className="visually-hidden">Search</span>
      </button>
      <div className="search-bar-panel">
        <input
          type="text"
          className="form-control toolbar-input search-bar-input"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (timerRef.current) {
                window.clearTimeout(timerRef.current);
              }
              onSearch?.();
            }
          }}
        />
      </div>
    </div>
  );
};

export default SearchBar;
