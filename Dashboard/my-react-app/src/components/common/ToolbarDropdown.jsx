import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ToolbarButton from './ToolbarButton';

const ToolbarDropdown = ({
  open,
  onToggle,
  label,
  icon,
  children,
  className = '',
  panelClassName = '',
  align = 'end',
  buttonVariant = 'secondary',
  buttonClassName = '',
  active = open,
  iconOnly = false,
}) => {
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState(undefined);
  const [isRenderable, setIsRenderable] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(undefined);
      setIsRenderable(false);
      return undefined;
    }

    const rootElement = rootRef.current;
    const isVisible = Boolean(rootElement && rootElement.getClientRects().length > 0);
    setIsRenderable(isVisible);

    if (!isVisible) {
      setPanelStyle(undefined);
      return undefined;
    }

    const updatePanelPosition = () => {
      const rootElement = rootRef.current;
      const panelElement = panelRef.current;

      if (!rootElement || !panelElement) {
        return;
      }

      const rect = rootElement.getBoundingClientRect();
      const panelHeight = Math.ceil(panelElement.scrollHeight || panelElement.getBoundingClientRect().height || 0);
      const viewportPadding = 12;
      const gap = 10;
      const nextStyle = {
        position: 'fixed',
        top: `${Math.max(viewportPadding, Math.round(rect.bottom + gap))}px`,
        zIndex: 1030,
      };

      if (align === 'start') {
        nextStyle.left = `${Math.max(viewportPadding, Math.round(rect.left))}px`;
        nextStyle.right = 'auto';
      } else if (align === 'center') {
        nextStyle.left = `${Math.round(rect.left + rect.width / 2)}px`;
        nextStyle.right = 'auto';
        nextStyle.transform = 'translateX(-50%)';
      } else {
        nextStyle.right = `${Math.max(viewportPadding, Math.round(window.innerWidth - rect.right))}px`;
        nextStyle.left = 'auto';
      }

      if (rect.bottom + gap + panelHeight > window.innerHeight - viewportPadding) {
        nextStyle.top = `${Math.max(viewportPadding, Math.round(rect.top - gap - panelHeight))}px`;
      }

      setPanelStyle(nextStyle);
    };

    updatePanelPosition();

    const rafId = window.requestAnimationFrame(updatePanelPosition);
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [align, open]);

  useEffect(() => {
    const focusable = panelRef.current?.querySelector('input, select, textarea, button:not(.toolbar-dropdown-toggle)') || rootRef.current?.querySelector('input, select, textarea, button:not(.toolbar-dropdown-toggle)');
    if (open) {
      window.requestAnimationFrame(() => {
        focusable?.focus?.();
      });
    }
  }, [open]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!open) return;
      const insideRoot = rootRef.current?.contains(event.target);
      const insidePanel = panelRef.current?.contains(event.target);
      if (!insideRoot && !insidePanel) {
        onToggle(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onToggle(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToggle, open]);

  return (
    <div
      ref={rootRef}
      className={`toolbar-dropdown ${open ? 'open' : ''} ${className}`.trim()}
    >
      <ToolbarButton
        icon={icon}
        iconOnly={iconOnly}
        label={label}
        variant={buttonVariant}
        active={active}
        className={`toolbar-dropdown-toggle ${buttonClassName}`.trim()}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        {label}
      </ToolbarButton>
      {open && isRenderable && createPortal(
        <div
          ref={panelRef}
          className={`toolbar-dropdown-panel open align-${align} ${panelClassName}`.trim()}
          role="region"
          aria-hidden={!open}
          style={panelStyle}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="toolbar-dropdown-panel-inner">
            {children}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ToolbarDropdown;