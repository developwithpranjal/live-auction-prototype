import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import toast from "react-hot-toast";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price || 0);

const Checkout = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshWallet } = useAuth();
  
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Delivery Details state
  const [delivery, setDelivery] = useState({
    address: "",
    city: "",
    pincode: "",
    phone: "",
  });
  
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const fetchAuction = async () => {
      try {
        const { data } = await api.get(`/auctions/${id}`);
        setAuction(data.auction);
      } catch (err) {
        toast.error("Failed to load auction details");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetchAuction();
  }, [id, navigate]);

  const handlePayment = async () => {
    // Validate delivery details
    if (!delivery.address || !delivery.city || !delivery.pincode || !delivery.phone) {
      setFormError("Please fill out all delivery details before checking out.");
      return;
    }
    setFormError("");

    try {
      setProcessing(true);
      await api.post(`/checkout/${id}`, delivery);
      await refreshWallet();
      setSuccess(true);
      toast.success("Payment successful!");
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate(`/track/${id}`);
      }, 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || "Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleChange = (e) => {
    setDelivery({ ...delivery, [e.target.name]: e.target.value });
    setFormError("");
  };

  if (loading) return <div className="loading-state">Loading checkout...</div>;
  if (!auction) return <div className="error-state">Auction not found</div>;

  const hasEnoughBalance = user?.walletBalance >= auction.currentPrice;

  return (
    <div className="container page" style={{ maxWidth: 700 }}>
      <div className="card" style={{ padding: "40px 30px" }}>
        
        {success ? (
          <div className="fade-in" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
            <h2 style={{ color: "var(--accent)", marginBottom: "1rem" }}>Payment Successful!</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
              You have successfully paid <strong>{formatPrice(auction.currentPrice)}</strong> for <strong>{auction.title}</strong>.
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Redirecting to your auctions...</p>
          </div>
        ) : (
          <div className="fade-in">
            <h1 style={{ marginBottom: "2rem", color: "var(--text-primary)", textAlign: "center" }}>Secure Checkout</h1>
            
            <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
              {/* Left Column: Delivery Info */}
              <div style={{ flex: "1 1 300px" }}>
                <h3 style={{ marginBottom: "15px", fontSize: "1.1rem" }}>Delivery Details</h3>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label className="form-label">Full Address</label>
                  <textarea 
                    className="form-textarea" 
                    name="address" 
                    value={delivery.address} 
                    onChange={handleChange} 
                    placeholder="123 Street Name, Apartment, etc."
                    style={{ minHeight: "80px" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">City</label>
                    <input 
                      className="form-input" 
                      type="text" 
                      name="city" 
                      value={delivery.city} 
                      onChange={handleChange} 
                      placeholder="City"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Pincode</label>
                    <input 
                      className="form-input" 
                      type="text" 
                      name="pincode" 
                      value={delivery.pincode} 
                      onChange={handleChange} 
                      placeholder="e.g. 400001"
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label className="form-label">Phone Number</label>
                  <input 
                    className="form-input" 
                    type="tel" 
                    name="phone" 
                    value={delivery.phone} 
                    onChange={handleChange} 
                    placeholder="10-digit number"
                  />
                </div>
              </div>

              {/* Right Column: Order Summary & Payment */}
              <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                <h3 style={{ marginBottom: "15px", fontSize: "1.1rem" }}>Order Summary</h3>
                <div style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "var(--radius-md)", marginBottom: "20px", flexGrow: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "var(--text-secondary)" }}>
                    <span>Item:</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{auction.title}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
                    <span>Winning Bid:</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatPrice(auction.currentPrice)}</span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Your Wallet Balance:</span>
                    <span style={{ fontWeight: 600, color: hasEnoughBalance ? "var(--accent)" : "var(--danger)" }}>
                      {formatPrice(user?.walletBalance)}
                    </span>
                  </div>
                </div>

                {!hasEnoughBalance && (
                  <div style={{ color: "var(--danger)", marginBottom: "1rem", fontSize: "0.9rem", background: "var(--danger-light)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
                    Insufficient balance. Please add funds to your wallet first.
                  </div>
                )}
                
                {formError && (
                  <div style={{ color: "var(--danger)", marginBottom: "1rem", fontSize: "0.9rem" }}>
                    {formError}
                  </div>
                )}

                <button
                  onClick={handlePayment}
                  disabled={processing || !hasEnoughBalance || auction.isPaid}
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%" }}
                >
                  {processing ? "Processing..." : `Confirm Payment`}
                </button>
                
                <button
                  onClick={() => navigate(-1)}
                  className="btn btn-outline"
                  style={{ width: "100%", marginTop: "1rem" }}
                  disabled={processing}
                >
                  Cancel & Go Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
