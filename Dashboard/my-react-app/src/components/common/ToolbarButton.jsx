const joinClasses = (...parts) => parts.filter(Boolean).join(' ');

const ToolbarButton = ({
  icon,
  children,
  variant = 'secondary',
  iconOnly = false,
  active = false,
  compact = false,
  className = '',
  label,
  title,
  type = 'button',
  ...props
}) => {
  const isIconOnly = iconOnly || (typeof children !== 'string' && !children && Boolean(icon));
  const accessibleLabel = label || title || (typeof children === 'string' ? children : 'Toolbar action');

  return (
    <button
      type={type}
      className={joinClasses(
        'toolbar-button',
        variant,
        isIconOnly && 'icon-only',
        compact && 'compact',
        active && 'active',
        className,
      )}
      aria-label={isIconOnly ? accessibleLabel : props['aria-label']}
      title={title || accessibleLabel}
      {...props}
    >
      {icon && <span className="toolbar-button-icon" aria-hidden="true">{icon}</span>}
      {!isIconOnly && children && <span className="toolbar-button-label">{children}</span>}
      {isIconOnly && <span className="visually-hidden">{accessibleLabel}</span>}
    </button>
  );
};

export default ToolbarButton;