import { useEffect, useRef } from 'react';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import ToolbarDropdown from './ToolbarDropdown';

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
    <ToolbarDropdown
      open={open}
      onToggle={onToggle}
      label="Search"
      icon={<HiOutlineMagnifyingGlass />}
      className={`search-panel-shell ${open ? 'open' : ''} ${className}`.trim()}
      panelClassName="toolbar-search-panel toolbar-panel-surface toolbar-popover-wide"
      buttonClassName="search-toggle toolbar-search-trigger"
      buttonVariant="secondary"
      align="end"
    >
      <div className="toolbar-search-panel-inner">
        <span className="toolbar-search-input-icon" aria-hidden="true">
          <HiOutlineMagnifyingGlass />
        </span>
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
    </ToolbarDropdown>
  );
};

export default SearchBar;
