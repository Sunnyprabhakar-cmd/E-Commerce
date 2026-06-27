import LoadingSpinner from './LoadingSpinner';

const PageLoader = (props) => <LoadingSpinner {...props} className={`page-loader-shell ${props?.className || ''}`.trim()} />;

export default PageLoader;
