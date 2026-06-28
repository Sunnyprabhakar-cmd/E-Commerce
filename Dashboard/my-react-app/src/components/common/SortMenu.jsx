import { HiOutlineArrowsUpDown } from 'react-icons/hi2';
import IconMenu from './IconMenu';

const SortMenu = ({ open, onToggle, label = 'Sort', children, className = '' }) => (
  <IconMenu
    open={open}
    onToggle={onToggle}
    icon={<HiOutlineArrowsUpDown />}
    label={label}
    className={`sort-menu-shell ${className}`.trim()}
  >
    <div className="sort-menu-content">
      {children}
    </div>
  </IconMenu>
);

export default SortMenu;