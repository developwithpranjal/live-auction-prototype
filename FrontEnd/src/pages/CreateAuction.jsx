import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import "../styles/create-auction.css";

const CreateAuction = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startPrice: "",
    bidIncrement: "100",
    startTime: "",
    endTime: "",
  });
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="container">
        <div className="error-state">Please log in to create an auction.</div>
      </div>
    );
  }

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      setError("End time must be after start time");
      return;
    }

    const fd = new FormData();
    Object.entries(formData).forEach(([key, val]) => {
      if (key === "startTime" || key === "endTime") {
        // Convert the local datetime string from the input into an absolute UTC ISO string.
        // This ensures the backend stores the correct absolute time regardless of its own timezone.
        fd.append(key, new Date(val).toISOString());
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

  // Helper: get a datetime-local string for "now" (min value for inputs)
  const nowLocal = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  };

  return (
    <div className="create-auction-page">
      <div className="create-auction-header">
        <h1>Create Auction</h1>
        <p>List an item for live bidding</p>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form
        id="create-auction-form"
        className="create-auction-form"
        onSubmit={handleSubmit}
      >
        {/* Basic Info */}
        <div className="create-auction-section">
          <div className="create-auction-section-title">Item Details</div>

          <div className="form-group">
            <label className="form-label" htmlFor="auction-title">
              Title *
            </label>
            <input
              id="auction-title"
              name="title"
              type="text"
              className="form-input"
              placeholder="e.g., Vintage Rolex Submariner 1960"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auction-description">
              Description
            </label>
            <textarea
              id="auction-description"
              name="description"
              className="form-textarea"
              placeholder="Describe the item in detail..."
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>
        </div>

        {/* Images */}
        <div className="create-auction-section">
          <div className="create-auction-section-title">Images (max 5)</div>

          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              id="auction-images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
            <div className="upload-zone-icon">📸</div>
            <p className="upload-zone-text">
              Click to upload images
            </p>
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

        {/* Pricing */}
        <div className="create-auction-section">
          <div className="create-auction-section-title">Pricing</div>

          <div className="create-auction-row">
            <div className="form-group">
              <label className="form-label" htmlFor="auction-startPrice">
                Starting Price (₹) *
              </label>
              <input
                id="auction-startPrice"
                name="startPrice"
                type="number"
                className="form-input"
                placeholder="500"
                value={formData.startPrice}
                onChange={handleChange}
                required
                min="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auction-bidIncrement">
                Bid Increment (₹) *
              </label>
              <input
                id="auction-bidIncrement"
                name="bidIncrement"
                type="number"
                className="form-input"
                placeholder="100"
                value={formData.bidIncrement}
                onChange={handleChange}
                required
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Timing */}
        <div className="create-auction-section">
          <div className="create-auction-section-title">Schedule</div>

          <div className="create-auction-row">
            <div className="form-group">
              <label className="form-label" htmlFor="auction-startTime">
                Start Time *
              </label>
              <input
                id="auction-startTime"
                name="startTime"
                type="datetime-local"
                className="form-input"
                value={formData.startTime}
                onChange={handleChange}
                required
                min={nowLocal()}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auction-endTime">
                End Time *
              </label>
              <input
                id="auction-endTime"
                name="endTime"
                type="datetime-local"
                className="form-input"
                value={formData.endTime}
                onChange={handleChange}
                required
                min={formData.startTime || nowLocal()}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          id="create-auction-submit-btn"
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading}
        >
          {loading ? "Creating Auction..." : "🔨 Create Auction"}
        </button>
      </form>
    </div>
  );
};

export default CreateAuction;
