import { HiOutlinePencilSquare, HiOutlineTrash } from 'react-icons/hi2';
import { formatINR } from '../../utils/currency';
import ToolbarButton from './ToolbarButton';

const getAvailabilityClass = (availability) => (availability ? 'is-available' : 'is-out');

const ProductCard = ({ product, canManageProducts, onEdit, onDelete, onAddToCart }) => (
  <div className="card h-100 product-row-card">
    <div className="card-body product-card-body">
      <div className="product-card-hero">
        <div className="product-thumb">
          <div className="product-thumb-inner">{String(product.name || '').slice(0, 1).toUpperCase()}</div>
        </div>

        <div className="product-card-copy">
          <div className="product-card-heading">
            <h5 className="card-title mb-0">{product.name}</h5>
            <span className="badge text-bg-warning">ID #{product.id}</span>
          </div>
          <div className="product-card-subtitle">{product.category || 'Uncategorized'}</div>
        </div>
      </div>

      <div className="product-card-info-grid">
        <div className="product-card-stat">
          <span>Category</span>
          <strong>{product.category || 'N/A'}</strong>
        </div>
        <div className="product-card-stat">
          <span>Pieces</span>
          <strong>{product.piece}</strong>
        </div>
        <div className="product-card-stat">
          <span>Price</span>
          <strong>{formatINR(product.price)}</strong>
        </div>
        <div className="product-card-stat">
          <span>Availability</span>
          <strong className={`product-availability-badge ${getAvailabilityClass(product.availability)}`}>
            {product.availability ? 'Available' : 'Out of Stock'}
          </strong>
        </div>
      </div>

      <div className="product-card-actions">
        {canManageProducts ? (
          <>
            <ToolbarButton
              variant="outline-primary"
              compact
              icon={<HiOutlinePencilSquare />}
              label={`Edit ${product.name}`}
              onClick={() => onEdit(product)}
            >
              Edit
            </ToolbarButton>
            <ToolbarButton
              variant="outline-danger"
              compact
              icon={<HiOutlineTrash />}
              label={`Delete ${product.name}`}
              onClick={() => onDelete(product.id)}
            >
              Delete
            </ToolbarButton>
          </>
        ) : (
          <ToolbarButton
            variant="primary"
            compact
            onClick={() => onAddToCart(product.id)}
            label={`Add ${product.name} to cart`}
          >
            Add to Cart
          </ToolbarButton>
        )}
      </div>
    </div>
  </div>
);

export default ProductCard;