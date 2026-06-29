import { HiOutlineArrowsUpDown, HiOutlineCheck } from 'react-icons/hi2';
import ToolbarDropdown from './ToolbarDropdown';

const SortMenu = ({ open, onToggle, label = 'Sort', children, className = '' }) => (
  <ToolbarDropdown
    open={open}
    onToggle={onToggle}
    icon={<HiOutlineArrowsUpDown />}
    label={label}
    className={`sort-menu-shell ${className}`.trim()}
    panelClassName="toolbar-sort-panel toolbar-panel-surface toolbar-popover-compact"
    buttonClassName="sort-menu-toggle"
    buttonVariant="secondary"
    align="end"
  >
    <div className="toolbar-sort-list">
      {children}
    </div>
  </ToolbarDropdown>
);

export default SortMenu;