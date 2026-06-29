const PageContainer = ({ children, className = '' }) => (
  <div className={`page-container container ${className}`.trim()}>
    {children}
  </div>
);

export default PageContainer;
