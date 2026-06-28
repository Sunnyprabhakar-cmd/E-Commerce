import { HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2';

const FilterPanel = ({ open, title = 'Filters', onToggle, children, onApply, onReset, className = '' }) => (
  <section className={`filter-panel-shell ${open ? 'open' : ''} ${className}`.trim()}>
    <button type="button" className="toolbar-button secondary filter-panel-toggle" onClick={onToggle} aria-expanded={open} aria-label={title} title={title}>
      <HiOutlineAdjustmentsHorizontal />
      <span className="filter-panel-label">{title}</span>
    </button>
    <div className="filter-panel-body">
      {children}
      <div className="filter-panel-actions">
        <button type="button" className="toolbar-button primary" onClick={onApply}>
          Apply
        </button>
        <button type="button" className="toolbar-button" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  </section>
);

export default FilterPanel;
