import { HiOutlineArrowDownTray } from 'react-icons/hi2';
import ToolbarDropdown from './ToolbarDropdown';
import ToolbarButton from './ToolbarButton';

const ExportMenu = ({ open, onToggle, label = 'Export', items = [], className = '' }) => (
  <ToolbarDropdown
    open={open}
    onToggle={onToggle}
    icon={<HiOutlineArrowDownTray />}
    label={label}
    className={`export-menu-shell ${className}`.trim()}
    panelClassName="export-menu-content toolbar-floating-menu toolbar-panel-surface toolbar-popover-compact"
    buttonClassName="export-menu-toggle"
    buttonVariant="secondary"
    align="end"
  >
    <div className="toolbar-dropdown-content">
      {items.map((item) => (
        <ToolbarButton
          key={item.label}
          variant={item.variant || 'secondary'}
          className="toolbar-overflow-item"
          onClick={() => {
            item.onClick?.();
            onToggle(false);
          }}
          icon={item.icon}
          label={item.label}
          compact
        >
          {item.label}
        </ToolbarButton>
      ))}
    </div>
  </ToolbarDropdown>
);

export default ExportMenu;
