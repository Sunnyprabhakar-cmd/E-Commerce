import { useState } from 'react';
import api from '../api/client';

const getInitialFormData = (product) => ({
  id: product?.id || '',
  name: product?.name || '',
  price: product?.price || '',
  category: product?.category || '',
  piece: product?.piece || '',
  availability: product?.availability ?? true
});

const ProductForm = ({ product, onSave, onCancel, canManageProducts }) => {
  const [formData, setFormData] = useState(() => getInitialFormData(product));
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
  const { name, value, type, checked } = e.target;

  setFormData({
    ...formData,
    [name]: type === "checkbox" ? checked : value,
  });
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageProducts) {
      setMessage('Only admin can create or update products.');
      return;
    }
    try {
      if (product) {
        // Update
        await api.post(`/update/${product.id}`, formData);
        setMessage('Product updated successfully!');
      } else {
        // Create
        await api.post('/', formData);
        setMessage('Product created successfully!');
      }
      setTimeout(() => {
        onSave();
        setMessage('');
      }, 1500);
    } catch (error) {
      const apiMessage = error.response?.data?.message || error.response?.data;
      setMessage(typeof apiMessage === 'string' ? apiMessage : 'Error occurred');
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h3>{product ? 'Edit Product' : 'Add Product'}</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
              <div className="mb-3">
              <label>Product ID</label>
              <input
                type="number"
                className="form-control"
                name="id"
                value={formData.id}
                onChange={handleChange}
                required
                />
            </div>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Price</label>
                  <input
                    type="number"
                    className="form-control"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="form-control"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label>Piece</label>
                   <input
                   type="number"
                   className="form-control"
                   name="piece"
                   value={formData.piece}
                   onChange={handleChange}
                   required
                   min="0"
                  />
                </div>
                <div className="mb-3">
                <label className="form-label">Availability</label>
               <input
                  type="checkbox"
                  className="form-check-input"
                  name="availability"
                  checked={formData.availability}
                  onChange={handleChange}
                />
                </div>
                <button type="submit" className="btn btn-primary me-2">
                  {product ? 'Update' : 'Create'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                  Cancel
                </button>
              </form>
              {message && <div className="alert alert-info mt-3">{message}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductForm;