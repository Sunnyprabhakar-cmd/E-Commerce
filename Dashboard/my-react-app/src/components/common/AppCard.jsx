import { useState } from 'react';
import { HiOutlineChevronDown } from 'react-icons/hi2';

const AppCard = ({
  title,
  subtitle,
  children,
  actions,
  className = '',
  collapsible = false,
  defaultOpen = true,
  collapseLabel,
  open,
  onToggle,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : internalOpen;
  const hasHeader = Boolean(title || subtitle || actions || collapsible);
  const toggleLabel = collapseLabel || (title ? `Toggle ${title}` : 'Toggle section');
  const handleToggle = () => {
    const next = !isOpen;
    if (isControlled) {
      onToggle?.(next);
      return;
    }
    setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={`app-card-shell card shadow-sm border-0 ${collapsible ? `app-card-collapsible ${isOpen ? 'is-open' : 'is-collapsed'}` : ''} ${className}`.trim()}>
      {hasHeader && (
        <div className="app-card-header card-header bg-transparent border-0 d-flex justify-content-between align-items-start gap-3">
          <div>
            {title && <h3 className="app-card-title mb-1">{title}</h3>}
            {subtitle && <p className="app-card-subtitle mb-0">{subtitle}</p>}
          </div>
          <div className="app-card-header-tools">
            {actions && <div className="app-card-actions">{actions}</div>}
            {collapsible && (
              <button
                type="button"
                className="app-card-collapse-button"
                onClick={handleToggle}
                aria-expanded={isOpen}
                aria-label={toggleLabel}
                title={toggleLabel}
              >
                <HiOutlineChevronDown />
              </button>
            )}
          </div>
        </div>
      )}
      {!collapsible ? (
        <div className="card-body app-card-body">{children}</div>
      ) : (
        <div className={`app-card-collapse-panel ${isOpen ? 'is-open' : 'is-collapsed'}`} aria-hidden={!isOpen}>
          <div className="app-card-collapse-panel-inner card-body app-card-body">{children}</div>
        </div>
      )}
    </div>
  );
};

export default AppCard;
