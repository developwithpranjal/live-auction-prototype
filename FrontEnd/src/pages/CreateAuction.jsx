import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import "../styles/create-auction.css";
import "../styles/create-auction-wizard.css";

import { CATEGORIES, CONDITIONS, ITEM_SPECIFICS_TEMPLATE } from "../data/categoryConfig.js";

const CreateAuction = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;

  const [formData, setFormData] = useState({
    // Step 1
    category: "",
    condition: "",
    // Step 2
    title: "",
    description: "",
    itemSpecifics: {},
    // Step 4
    startPrice: "",
    bidIncrement: "100",
    reservePrice: "",
    buyNowPrice: "",
    // Step 5
    startTime: "",
    endTime: "",
    // Step 6
    shippingDetails: {
      cost: "",
      weight: "",
      handlingDays: "",
      localPickupAvailable: false,
    },
    returnPolicy: {
      returnsAccepted: false,
      returnWindowDays: "",
    },
  });

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-populate itemSpecifics when category changes
  useEffect(() => {
    if (formData.category) {
      const template = ITEM_SPECIFICS_TEMPLATE[formData.category] || [];
      const newSpecifics = {};
      template.forEach((key) => {
        newSpecifics[key] = formData.itemSpecifics[key] || "";
      });
      setFormData((prev) => ({ ...prev, itemSpecifics: newSpecifics }));
    }
  }, [formData.category]);

  if (!user) {
    return (
      <div className="container">
        <div className="error-state">Please log in to create an auction.</div>
      </div>
    );
  }

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleNestedChange = (parent, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value,
      },
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      setError("Maximum 5 images allowed");
      return;
    }
    setImages((prev) => [...prev, ...files]);

    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleQuickDuration = (days) => {
    if (!formData.startTime) {
      setError("Please select a Start Time first.");
      return;
    }
    const start = new Date(formData.startTime);
    start.setDate(start.getDate() + days);
    
    // adjust to local string
    const offset = start.getTimezoneOffset() * 60000;
    const localISOTime = new Date(start - offset).toISOString().slice(0, 16);
    
    setFormData((prev) => ({ ...prev, endTime: localISOTime }));
    setError("");
  };

  // Helper: get a datetime-local string for "now"
  const nowLocal = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().slice(0, 16);
  };

  const validateStep = () => {
    setError("");
    switch (currentStep) {
      case 1:
        if (!formData.category) { setError("Category is required"); return false; }
        if (!formData.condition) { setError("Condition is required"); return false; }
        break;
      case 2:
        if (!formData.title) { setError("Title is required"); return false; }
        if (formData.title.length > 100) { setError("Title cannot exceed 100 characters"); return false; }
        break;
      case 3:
        if (images.length === 0) { setError("At least one image is required"); return false; }
        break;
      case 4:
        if (!formData.startPrice || formData.startPrice <= 0) { setError("Valid starting price is required"); return false; }
        if (!formData.bidIncrement || formData.bidIncrement <= 0) { setError("Valid bid increment is required"); return false; }
        if (formData.reservePrice && Number(formData.reservePrice) < Number(formData.startPrice)) {
          setError("Reserve price cannot be less than starting price");
          return false;
        }
        break;
      case 5:
        if (!formData.startTime) { setError("Start time is required"); return false; }
        if (!formData.endTime) { setError("End time is required"); return false; }
        if (new Date(formData.endTime) <= new Date(formData.startTime)) {
          setError("End time must be after start time");
          return false;
        }
        break;
      case 6:
        if (formData.returnPolicy.returnsAccepted && !formData.returnPolicy.returnWindowDays) {
          setError("Return window days is required if returns are accepted");
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
    setError("");
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    const fd = new FormData();
    Object.entries(formData).forEach(([key, val]) => {
      if (key === "startTime" || key === "endTime") {
        fd.append(key, new Date(val).toISOString());
      } else if (typeof val === 'object' && val !== null) {
        fd.append(key, JSON.stringify(val));
      } else {
        fd.append(key, val);
      }
    });
    images.forEach((img) => fd.append("images", img));

    try {
      setLoading(true);
      const { data } = await api.post("/auctions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/auction/${data.auction._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create auction");
    } finally {
      setLoading(false);
    }
  };

  // ── Render Steps ────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="create-auction-section fade-in">
      <div className="create-auction-section-title">Category & Condition</div>
      
      <div className="form-group">
        <label className="form-label">Category *</label>
        <select className="form-input" name="category" value={formData.category} onChange={handleChange} required>
          <option value="">Select a category</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Condition *</label>
        <select className="form-input" name="condition" value={formData.condition} onChange={handleChange} required>
          <option value="">Select item condition</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const specificsKeys = Object.keys(formData.itemSpecifics);
    return (
      <div className="create-auction-section fade-in">
        <div className="create-auction-section-title">Item Details</div>
        
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            name="title"
            type="text"
            className="form-input"
            placeholder="e.g., Vintage Rolex Submariner 1960"
            value={formData.title}
            onChange={handleChange}
            maxLength={100}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            name="description"
            className="form-textarea"
            placeholder="Describe the item in detail..."
            value={formData.description}
            onChange={handleChange}
            rows={4}
          />
        </div>

        {specificsKeys.length > 0 && (
          <div className="form-group" style={{ marginTop: 10 }}>
            <label className="form-label" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
              Item Specifics ({formData.category})
            </label>
            <div className="create-auction-row">
              {specificsKeys.map(key => (
                <div key={key} className="form-group" style={{ gap: 4 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>{key}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.itemSpecifics[key]}
                    onChange={(e) => handleNestedChange('itemSpecifics', key, e.target.value)}
                    placeholder={`Enter ${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="create-auction-section fade-in">
      <div className="create-auction-section-title">Images (max 5) *</div>

      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          style={{ display: "none" }}
        />
        <div className="upload-zone-icon">📸</div>
        <p className="upload-zone-text">Click to upload images</p>
        <p className="upload-zone-hint">JPG, PNG, WebP — max 5MB each</p>
      </div>

      {previews.length > 0 && (
        <div className="upload-previews">
          {previews.map((src, i) => (
            <div key={i} className="upload-preview">
              <img src={src} alt={`Preview ${i + 1}`} />
              <button
                type="button"
                className="upload-preview-remove"
                onClick={() => removeImage(i)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="create-auction-section fade-in">
      <div className="create-auction-section-title">Pricing</div>

      <div className="create-auction-row">
        <div className="form-group">
          <label className="form-label">Starting Price (₹) *</label>
          <input
            name="startPrice"
            type="number"
            className="form-input"
            placeholder="500"
            value={formData.startPrice}
            onChange={handleChange}
            min="1"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Bid Increment (₹) *</label>
          <input
            name="bidIncrement"
            type="number"
            className="form-input"
            placeholder="100"
            value={formData.bidIncrement}
            onChange={handleChange}
            min="1"
            required
          />
        </div>
      </div>

      <div className="create-auction-row" style={{ marginTop: 10 }}>
        <div className="form-group">
          <label className="form-label">Reserve Price (₹) (Optional)</label>
          <input
            name="reservePrice"
            type="number"
            className="form-input"
            placeholder="Minimum amount to sell"
            value={formData.reservePrice}
            onChange={handleChange}
            min={formData.startPrice || 1}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Buy Now Price (₹) (Optional)</label>
          <input
            name="buyNowPrice"
            type="number"
            className="form-input"
            placeholder="Amount to purchase instantly"
            value={formData.buyNowPrice}
            onChange={handleChange}
            min={formData.startPrice || 1}
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="create-auction-section fade-in">
      <div className="create-auction-section-title">Schedule</div>

      <div className="create-auction-row">
        <div className="form-group">
          <label className="form-label">Start Time *</label>
          <input
            name="startTime"
            type="datetime-local"
            className="form-input"
            value={formData.startTime}
            onChange={handleChange}
            min={nowLocal()}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">End Time *</label>
          <input
            name="endTime"
            type="datetime-local"
            className="form-input"
            value={formData.endTime}
            onChange={handleChange}
            min={formData.startTime || nowLocal()}
            required
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 15 }}>
        <label className="form-label" style={{ fontSize: '0.8rem' }}>Quick Duration</label>
        <div className="quick-duration-group">
          <button type="button" className="quick-duration-btn" onClick={() => handleQuickDuration(1)}>1 Day</button>
          <button type="button" className="quick-duration-btn" onClick={() => handleQuickDuration(3)}>3 Days</button>
          <button type="button" className="quick-duration-btn" onClick={() => handleQuickDuration(7)}>7 Days</button>
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="create-auction-section fade-in">
      <div className="create-auction-section-title">Shipping & Returns</div>

      <div className="create-auction-row">
        <div className="form-group">
          <label className="form-label">Shipping Cost (₹)</label>
          <input
            type="number"
            className="form-input"
            placeholder="0 for free shipping"
            value={formData.shippingDetails.cost}
            onChange={(e) => handleNestedChange('shippingDetails', 'cost', e.target.value)}
            min="0"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Weight (kg)</label>
          <input
            type="number"
            className="form-input"
            placeholder="Approximate weight"
            value={formData.shippingDetails.weight}
            onChange={(e) => handleNestedChange('shippingDetails', 'weight', e.target.value)}
            min="0"
          />
        </div>
      </div>

      <div className="create-auction-row" style={{ marginTop: 10 }}>
        <div className="form-group">
          <label className="form-label">Handling Time (Days)</label>
          <input
            type="number"
            className="form-input"
            placeholder="Days to ship"
            value={formData.shippingDetails.handlingDays}
            onChange={(e) => handleNestedChange('shippingDetails', 'handlingDays', e.target.value)}
            min="0"
          />
        </div>
      </div>

      <div className="toggle-group" style={{ marginTop: 10 }}>
        <label>Local Pickup Available</label>
        <input 
          type="checkbox" 
          id="local-pickup" 
          style={{ display: 'none' }} 
          checked={formData.shippingDetails.localPickupAvailable}
          onChange={(e) => handleNestedChange('shippingDetails', 'localPickupAvailable', e.target.checked)}
        />
        <label htmlFor="local-pickup" className="toggle-switch"></label>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '20px 0' }} />

      <div className="toggle-group">
        <label>Accept Returns</label>
        <input 
          type="checkbox" 
          id="accept-returns" 
          style={{ display: 'none' }}
          checked={formData.returnPolicy.returnsAccepted}
          onChange={(e) => handleNestedChange('returnPolicy', 'returnsAccepted', e.target.checked)}
        />
        <label htmlFor="accept-returns" className="toggle-switch"></label>
      </div>

      {formData.returnPolicy.returnsAccepted && (
        <div className="form-group" style={{ marginTop: 15 }}>
          <label className="form-label">Return Window (Days)</label>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 14, 30"
            value={formData.returnPolicy.returnWindowDays}
            onChange={(e) => handleNestedChange('returnPolicy', 'returnWindowDays', e.target.value)}
            min="1"
          />
        </div>
      )}
    </div>
  );

  const renderStep7 = () => (
    <div className="create-auction-section fade-in">
      <div className="create-auction-section-title" style={{ border: 'none', marginBottom: 0 }}>Review & Publish</div>
      <div className="review-summary">
        
        <div className="review-section">
          <div className="review-section-header">
            <h3>1. Category & Condition</h3>
            <button type="button" className="review-edit-btn" onClick={() => setCurrentStep(1)}>Edit</button>
          </div>
          <div className="review-grid">
            <div className="review-item"><span className="review-label">Category</span><span className="review-value">{formData.category}</span></div>
            <div className="review-item"><span className="review-label">Condition</span><span className="review-value">{formData.condition}</span></div>
          </div>
        </div>

        <div className="review-section">
          <div className="review-section-header">
            <h3>2. Details</h3>
            <button type="button" className="review-edit-btn" onClick={() => setCurrentStep(2)}>Edit</button>
          </div>
          <div className="review-item" style={{ marginBottom: 12 }}>
            <span className="review-label">Title</span><span className="review-value">{formData.title}</span>
          </div>
          <div className="review-grid">
            {Object.entries(formData.itemSpecifics).map(([k, v]) => v && (
              <div key={k} className="review-item"><span className="review-label">{k}</span><span className="review-value">{v}</span></div>
            ))}
          </div>
        </div>

        <div className="review-section">
          <div className="review-section-header">
            <h3>3. Pricing & Schedule</h3>
            <button type="button" className="review-edit-btn" onClick={() => { setCurrentStep(4); }}>Edit Pricing</button>
          </div>
          <div className="review-grid">
            <div className="review-item"><span className="review-label">Start Price</span><span className="review-value">₹{formData.startPrice}</span></div>
            <div className="review-item"><span className="review-label">Reserve Price</span><span className="review-value">{formData.reservePrice ? `₹${formData.reservePrice}` : 'None'}</span></div>
            <div className="review-item"><span className="review-label">Start Time</span><span className="review-value">{new Date(formData.startTime).toLocaleString()}</span></div>
            <div className="review-item"><span className="review-label">End Time</span><span className="review-value">{new Date(formData.endTime).toLocaleString()}</span></div>
          </div>
        </div>

      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  const stepsList = ["Category", "Details", "Images", "Pricing", "Schedule", "Shipping", "Publish"];

  return (
    <div className="create-auction-page">
      <div className="create-auction-header">
        <h1>Create Auction</h1>
        <p>List an item for live bidding</p>
      </div>

      <div className="wizard-container">
        
        {/* Stepper */}
        <div className="wizard-stepper">
          {stepsList.map((label, index) => {
            const stepNum = index + 1;
            const isActive = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;
            return (
              <div key={stepNum} className={`wizard-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}>
                <div className="wizard-step-circle">
                  {isCompleted ? "✓" : stepNum}
                </div>
                <div className="wizard-step-label">{label}</div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="auth-error fade-in" style={{ marginBottom: 0 }}>
            {error}
          </div>
        )}

        {/* Form Area */}
        <div className="create-auction-form">
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        <div className="wizard-navigation">
          {currentStep > 1 ? (
            <button type="button" className="btn btn-outline" onClick={handleBack} disabled={loading}>
              ← Back
            </button>
          ) : <div></div>}

          {currentStep < totalSteps ? (
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              Next →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
              {loading ? "Creating..." : "🔨 Create Auction"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateAuction;
