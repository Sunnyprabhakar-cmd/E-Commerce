import { useEffect, useRef } from 'react';

const IconMenu = ({ open, onToggle, icon, label, children, className = '' }) => {
  const rootRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onToggle(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onToggle]);

  return (
    <div ref={rootRef} className={`icon-menu-shell ${open ? 'open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="toolbar-button icon-only icon-menu-toggle"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className="visually-hidden">{label}</span>
      </button>
      <div className="icon-menu-panel">
        {children}
      </div>
    </div>
  );
};

export default IconMenu;