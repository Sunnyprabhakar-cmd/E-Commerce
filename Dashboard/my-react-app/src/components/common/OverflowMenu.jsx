import { HiOutlineEllipsisVertical } from 'react-icons/hi2';
import ToolbarDropdown from './ToolbarDropdown';
import ToolbarButton from './ToolbarButton';

const OverflowMenu = ({ open, onToggle, label = 'More actions', items = [], className = '' }) => (
  <ToolbarDropdown
    open={open}
    onToggle={onToggle}
    label={label}
    icon={<HiOutlineEllipsisVertical />}
    className={`toolbar-overflow-menu ${className}`.trim()}
    panelClassName="toolbar-overflow-panel toolbar-panel-surface"
    buttonClassName="toolbar-overflow-toggle"
    buttonVariant="secondary"
    align="end"
    iconOnly
  >
    <div className="toolbar-overflow-list">
      {items.map((item) => (
        <ToolbarButton
          key={item.label}
          icon={item.icon}
          variant={item.variant || 'secondary'}
          className="toolbar-overflow-item"
          onClick={() => {
            item.onClick?.();
            onToggle(false);
          }}
          label={item.label}
          compact
        >
          {item.label}
        </ToolbarButton>
      ))}
    </div>
  </ToolbarDropdown>
);

export default OverflowMenu;