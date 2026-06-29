import { useEffect } from 'react';

const Toolbar = ({
  kicker,
  title,
  description,
  actions,
  mobileActions,
  children,
  className = '',
  onSearchShortcut,
  onRefreshShortcut,
  onClosePanels,
}) => {
  useEffect(() => {
    if (!onSearchShortcut && !onRefreshShortcut && !onClosePanels) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClosePanels?.();
        return;
      }

      const isModifierKey = event.ctrlKey || event.metaKey;
      if (!isModifierKey) {
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        onSearchShortcut?.();
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        onRefreshShortcut?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClosePanels, onRefreshShortcut, onSearchShortcut]);

  return (
    <section className={`toolbar-shell ${className}`.trim()}>
      <div className="toolbar-shell-top">
        <div className="toolbar-shell-copy">
          {kicker && <div className="toolbar-shell-kicker">{kicker}</div>}
          {title && <h2 className="toolbar-shell-title">{title}</h2>}
          {description && <p className="toolbar-shell-description">{description}</p>}
        </div>
        {actions && <div className="toolbar-shell-actions desktop">{actions}</div>}
        {mobileActions && <div className="toolbar-shell-actions mobile">{mobileActions}</div>}
      </div>
      {children}
    </section>
  );
};

export default Toolbar;