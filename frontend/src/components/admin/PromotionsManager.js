import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './PromotionsManager.css';

const PromotionsManager = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    videoUrl: '',
    buttonText: '',
    buttonUrl: '',
    isActive: true,
    showOnLanding: true,
    displayOrder: 0,
    isPopup: false,
    popupPages: [],
    popupFrequency: 'once',
    popupStartDate: '',
    popupEndDate: ''
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/promotions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPromotions(response.data.promotions);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('Failed to fetch promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingPromotion 
        ? `/api/promotions/${editingPromotion._id}`
        : '/api/promotions';
      const method = editingPromotion ? 'put' : 'post';

      const response = await axios[method](url, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(editingPromotion ? 'Promotion updated successfully' : 'Promotion created successfully');
        fetchPromotions();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error(error.response?.data?.message || 'Failed to save promotion');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      title: promotion.title,
      description: promotion.description,
      videoUrl: promotion.videoUrl || '',
      buttonText: promotion.buttonText || '',
      buttonUrl: promotion.buttonUrl || '',
      isActive: promotion.isActive,
      showOnLanding: promotion.showOnLanding,
      displayOrder: promotion.displayOrder,
      isPopup: promotion.isPopup,
      popupPages: promotion.popupPages || [],
      popupFrequency: promotion.popupFrequency || 'once',
      popupStartDate: promotion.popupStartDate ? promotion.popupStartDate.substring(0, 10) : '',
      popupEndDate: promotion.popupEndDate ? promotion.popupEndDate.substring(0, 10) : ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promotion?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/promotions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Promotion deleted successfully');
      fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast.error('Failed to delete promotion');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`/api/promotions/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(response.data.message);
        fetchPromotions();
      }
    } catch (error) {
      console.error('Error toggling promotion status:', error);
      toast.error('Failed to toggle promotion status');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      videoUrl: '',
      buttonText: '',
      buttonUrl: '',
      isActive: true,
      showOnLanding: true,
      displayOrder: 0,
      isPopup: false,
      popupPages: [],
      popupFrequency: 'once',
      popupStartDate: '',
      popupEndDate: ''
    });
    setEditingPromotion(null);
    setShowForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'popupPages') {
      const pages = [...formData.popupPages];
      if (checked) {
        pages.push(value);
      } else {
        const index = pages.indexOf(value);
        if (index > -1) pages.splice(index, 1);
      }
      setFormData({ ...formData, popupPages: pages });
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  const convertGoogleDriveUrl = (url) => {
    if (!url) return '';
    
    // Convert Google Drive share link to embed link
    const shareMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)\/view/);
    if (shareMatch) {
      return `https://drive.google.com/file/d/${shareMatch[1]}/preview`;
    }
    
    // Convert Google Drive open link to embed link
    const openMatch = url.match(/\/open\?id=([a-zA-Z0-9-_]+)/);
    if (openMatch) {
      return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
    }
    
    return url;
  };

  if (loading && promotions.length === 0) {
    return (
      <div className="promotions-loading">
        <div className="loading-spinner"></div>
        <p>Loading promotions...</p>
      </div>
    );
  }

  return (
    <div className="promotions-manager">
      <div className="promotions-header">
        <h2>Promotions Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
        >
          Add New Promotion
        </button>
      </div>

      {showForm && (
        <div className="promotion-form-overlay">
          <div className="promotion-form-modal">
            <div className="form-header">
              <h3>{editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}</h3>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="promotion-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    maxLength={200}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="displayOrder">Display Order</label>
                  <input
                    type="number"
                    id="displayOrder"
                    name="displayOrder"
                    value={formData.displayOrder}
                    onChange={handleInputChange}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  maxLength={1000}
                />
                <small>{formData.description.length}/1000 characters</small>
              </div>

              <div className="form-group">
                <label htmlFor="videoUrl">Video URL (Google Drive, YouTube, Vimeo)</label>
                <input
                  type="url"
                  id="videoUrl"
                  name="videoUrl"
                  value={formData.videoUrl}
                  onChange={(e) => {
                    const convertedUrl = convertGoogleDriveUrl(e.target.value);
                    setFormData({ ...formData, videoUrl: convertedUrl });
                  }}
                  placeholder="https://drive.google.com/file/d/YOUR-FILE-ID/view?usp=sharing"
                />
                <small>
                  For Google Drive: Share the file publicly and paste the sharing link here. 
                  It will be automatically converted to an embed link.
                </small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="buttonText">Button Text</label>
                  <input
                    type="text"
                    id="buttonText"
                    name="buttonText"
                    value={formData.buttonText}
                    onChange={handleInputChange}
                    maxLength={50}
                    placeholder="Learn More"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="buttonUrl">Button URL</label>
                  <input
                    type="url"
                    id="buttonUrl"
                    name="buttonUrl"
                    value={formData.buttonUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Display Settings</h4>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                    />
                    Active
                  </label>
                  
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="showOnLanding"
                      checked={formData.showOnLanding}
                      onChange={handleInputChange}
                    />
                    Show on Landing Page
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h4>Popup Settings</h4>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isPopup"
                    checked={formData.isPopup}
                    onChange={handleInputChange}
                  />
                  Enable as Popup
                </label>

                {formData.isPopup && (
                  <>
                    <div className="form-group">
                      <label>Show Popup On:</label>
                      <div className="checkbox-group">
                        {['landing', 'login', 'signup', 'dashboard', 'all'].map((page) => (
                          <label key={page} className="checkbox-label">
                            <input
                              type="checkbox"
                              name="popupPages"
                              value={page}
                              checked={formData.popupPages.includes(page)}
                              onChange={handleInputChange}
                            />
                            {page.charAt(0).toUpperCase() + page.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="popupFrequency">Popup Frequency</label>
                        <select
                          id="popupFrequency"
                          name="popupFrequency"
                          value={formData.popupFrequency}
                          onChange={handleInputChange}
                        >
                          <option value="once">Once per user</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="always">Always</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="popupStartDate">Start Date</label>
                        <input
                          type="date"
                          id="popupStartDate"
                          name="popupStartDate"
                          value={formData.popupStartDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="popupEndDate">End Date</label>
                        <input
                          type="date"
                          id="popupEndDate"
                          name="popupEndDate"
                          value={formData.popupEndDate}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editingPromotion ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="promotions-list">
        {promotions.length === 0 ? (
          <div className="no-promotions">
            <p>No promotions found. Create your first promotion to get started.</p>
          </div>
        ) : (
          <div className="promotions-grid">
            {promotions.map((promotion) => (
              <div key={promotion._id} className="promotion-card">
                <div className="promotion-header">
                  <h3>{promotion.title}</h3>
                  <div className="promotion-status">
                    <span className={`status-badge ${promotion.isActive ? 'active' : 'inactive'}`}>
                      {promotion.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {promotion.isPopup && (
                      <span className="popup-badge">Popup</span>
                    )}
                  </div>
                </div>

                {promotion.videoUrl && (
                  <div className="promotion-video">
                    <iframe
                      src={promotion.videoUrl}
                      title={promotion.title}
                      frameBorder="0"
                      allowFullScreen
                    ></iframe>
                  </div>
                )}

                <div className="promotion-content">
                  <p>{promotion.description}</p>
                  
                  <div className="promotion-meta">
                    <div className="meta-item">
                      <strong>Order:</strong> {promotion.displayOrder}
                    </div>
                    <div className="meta-item">
                      <strong>Landing:</strong> {promotion.showOnLanding ? 'Yes' : 'No'}
                    </div>
                    {promotion.isPopup && (
                      <div className="meta-item">
                        <strong>Popup Pages:</strong> {promotion.popupPages.join(', ')}
                      </div>
                    )}
                    <div className="meta-item">
                      <strong>Created:</strong> {new Date(promotion.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="promotion-actions">
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => handleEdit(promotion)}
                    >
                      Edit
                    </button>
                    <button 
                      className={`btn btn-sm ${promotion.isActive ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => handleToggleStatus(promotion._id)}
                    >
                      {promotion.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(promotion._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionsManager;