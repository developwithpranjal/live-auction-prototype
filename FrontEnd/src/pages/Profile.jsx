import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import toast from "react-hot-toast";

const Profile = () => {
  const { user, updateUserSession } = useAuth();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    gender: "",
    mobile: "",
    dob: "",
    profilePicture: "",
    addresses: [],
  });

  const [loading, setLoading] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "Home", address: "", city: "", pincode: "", isDefault: false });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        password: "",
        gender: user.gender || "",
        mobile: user.mobile || "",
        dob: user.dob ? user.dob.split("T")[0] : "",
        profilePicture: user.profilePicture || "",
        addresses: user.addresses || [],
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast.error("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, profilePicture: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddAddress = () => {
    if (!newAddress.address || !newAddress.city || !newAddress.pincode) {
      toast.error("Please fill all address fields");
      return;
    }
    
    let updatedAddresses = [...formData.addresses];
    
    if (newAddress.isDefault) {
      updatedAddresses = updatedAddresses.map(a => ({ ...a, isDefault: false }));
    }
    
    // If it's the first address, make it default automatically
    const isFirst = updatedAddresses.length === 0;
    
    updatedAddresses.push({ ...newAddress, isDefault: isFirst ? true : newAddress.isDefault });
    
    setFormData((prev) => ({ ...prev, addresses: updatedAddresses }));
    setNewAddress({ label: "Home", address: "", city: "", pincode: "", isDefault: false });
    setShowAddressForm(false);
  };

  const handleRemoveAddress = (index) => {
    const updatedAddresses = formData.addresses.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, addresses: updatedAddresses }));
  };

  const handleSetDefaultAddress = (index) => {
    const updatedAddresses = formData.addresses.map((addr, i) => ({
      ...addr,
      isDefault: i === index
    }));
    setFormData((prev) => ({ ...prev, addresses: updatedAddresses }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = { ...formData };
      
      if (payload.password.trim() === "") {
        delete payload.password;
      } else if (payload.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

      const { data } = await api.put("/auth/profile", payload);
      updateUserSession(data);
      toast.success("Profile updated successfully!");
      setFormData(prev => ({ ...prev, password: "" }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="loading-state">Loading profile...</div>;

  return (
    <div className="container page" style={{ maxWidth: 800 }}>
      <div className="card" style={{ padding: "40px" }}>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
          {/* Avatar Upload */}
          <div 
            onClick={() => fileInputRef.current.click()}
            style={{
              width: "100px",
              height: "100px",
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "2.5rem",
              marginBottom: "1rem",
              boxShadow: "0 4px 15px rgba(162, 203, 139, 0.4)",
              cursor: "pointer",
              overflow: "hidden",
              position: "relative",
              border: "4px solid white"
            }}
            title="Click to change profile picture"
          >
            {formData.profilePicture ? (
              <img src={formData.profilePicture} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
            <div style={{
              position: "absolute",
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              width: "100%",
              textAlign: "center",
              fontSize: "0.6rem",
              padding: "2px 0",
              opacity: 0.8
            }}>
              EDIT
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            style={{ display: "none" }} 
          />
          <h1 style={{ color: "var(--text-primary)" }}>My Profile</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* ── Personal Info ────────────────────────── */}
          <div>
            <h3 style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "15px", color: "var(--accent)" }}>Personal Information</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" name="name" className="form-input" value={formData.name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" name="email" className="form-input" value={formData.email} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input type="tel" name="mobile" className="form-input" value={formData.mobile} onChange={handleChange} placeholder="e.g. +91 9876543210" />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input type="date" name="dob" className="form-input" value={formData.dob} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <select name="gender" className="form-input" value={formData.gender} onChange={handleChange}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" name="password" className="form-input" placeholder="Leave blank to keep current" value={formData.password} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* ── Addresses ────────────────────────────── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "10px", marginBottom: "15px" }}>
              <h3 style={{ color: "var(--accent)", margin: 0 }}>My Addresses</h3>
              <button type="button" onClick={() => setShowAddressForm(!showAddressForm)} className="btn btn-outline btn-sm">
                {showAddressForm ? "Cancel" : "+ Add Address"}
              </button>
            </div>

            {/* Existing Addresses List */}
            {formData.addresses.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px", marginBottom: "15px" }}>
                {formData.addresses.map((addr, index) => (
                  <div key={index} style={{
                    padding: "15px",
                    borderRadius: "12px",
                    border: `1px solid ${addr.isDefault ? "var(--accent)" : "var(--border)"}`,
                    background: addr.isDefault ? "rgba(162, 203, 139, 0.05)" : "var(--bg-secondary)",
                    position: "relative"
                  }}>
                    {addr.isDefault && <span style={{ position: "absolute", top: 10, right: 10, fontSize: "0.7rem", background: "var(--accent)", color: "white", padding: "2px 6px", borderRadius: "4px" }}>Default</span>}
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "1rem" }}>{addr.label}</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{addr.address}</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{addr.city} - {addr.pincode}</p>
                    
                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      {!addr.isDefault && (
                        <button type="button" onClick={() => handleSetDefaultAddress(index)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>Set Default</button>
                      )}
                      <button type="button" onClick={() => handleRemoveAddress(index)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem", padding: 0, marginLeft: addr.isDefault ? 0 : "auto" }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic", marginBottom: "15px" }}>No addresses saved yet.</p>
            )}

            {/* Add New Address Form */}
            {showAddressForm && (
              <div style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                <h4 style={{ marginBottom: "15px" }}>Add New Address</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Label</label>
                    <select className="form-input" value={newAddress.label} onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}>
                      <option value="Home">Home</option>
                      <option value="Work">Work</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input type="text" className="form-input" value={newAddress.city} onChange={(e) => setNewAddress({...newAddress, city: e.target.value})} placeholder="City" />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Full Address</label>
                    <input type="text" className="form-input" value={newAddress.address} onChange={(e) => setNewAddress({...newAddress, address: e.target.value})} placeholder="Street, House No." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pincode</label>
                    <input type="text" className="form-input" value={newAddress.pincode} onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})} placeholder="Pincode" />
                  </div>
                  <div className="form-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "auto" }}>
                    <input type="checkbox" id="defaultAddr" checked={newAddress.isDefault} onChange={(e) => setNewAddress({...newAddress, isDefault: e.target.checked})} />
                    <label htmlFor="defaultAddr" className="form-label" style={{ margin: 0 }}>Set as Default</label>
                  </div>
                </div>
                <button type="button" onClick={handleAddAddress} className="btn btn-primary btn-sm" style={{ marginTop: "15px" }}>
                  Save Address
                </button>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
            <button 
              type="submit" 
              className="btn btn-primary btn-lg" 
              style={{ width: "100%", background: "var(--accent)" }}
              disabled={loading}
            >
              {loading ? "Updating Profile..." : "Save All Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
