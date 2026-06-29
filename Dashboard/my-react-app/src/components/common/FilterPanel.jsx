import { HiOutlineFunnel } from 'react-icons/hi2';
import ToolbarDropdown from './ToolbarDropdown';

const FilterPanel = ({ open, title = 'Filters', onToggle, children, onApply, onReset, className = '' }) => (
  <ToolbarDropdown
    open={open}
    onToggle={onToggle}
    label={title}
    icon={<HiOutlineFunnel />}
    className={`filter-panel-shell ${open ? 'open' : ''} ${className}`.trim()}
    panelClassName="toolbar-filter-panel toolbar-panel-surface toolbar-popover-wide"
    buttonClassName="filter-panel-toggle"
    buttonVariant="secondary"
    align="end"
  >
    <div className="toolbar-filter-grid">
      {children}
      <div className="filter-panel-actions toolbar-panel-actions">
        <button type="button" className="toolbar-button primary" onClick={onApply}>
          Apply
        </button>
        <button type="button" className="toolbar-button" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  </ToolbarDropdown>
);

export default FilterPanel;
