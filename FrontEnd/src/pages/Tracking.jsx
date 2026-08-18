import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api.js";
import toast from "react-hot-toast";

const STAGES = [
  { id: "processing", label: "Processing", icon: "📦" },
  { id: "shipped", label: "Shipped", icon: "🚚" },
  { id: "out_for_delivery", label: "Out for Delivery", icon: "🏃" },
  { id: "delivered", label: "Delivered", icon: "🎉" },
];

const Tracking = () => {
  const { id } = useParams();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchAuction();
  }, [id]);

  const fetchAuction = async () => {
    try {
      const { data } = await api.get(`/auctions/${id}`);
      setAuction(data.auction);
    } catch (err) {
      toast.error("Failed to load tracking details");
    } finally {
      setLoading(false);
    }
  };

  const simulateNextStep = async () => {
    try {
      setSimulating(true);
      const { data } = await api.post(`/tracking/${id}/advance`);
      setAuction((prev) => ({ ...prev, deliveryStatus: data.deliveryStatus }));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to advance status");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return <div className="loading-state">Loading tracking info...</div>;
  if (!auction) return <div className="error-state">Order not found</div>;

  const currentStatusIndex = STAGES.findIndex((s) => s.id === (auction.deliveryStatus || "processing"));

  return (
    <div className="container page" style={{ maxWidth: 800 }}>
      <div className="card" style={{ padding: "40px", textAlign: "center" }}>
        <h1 style={{ marginBottom: "1rem", color: "var(--text-primary)" }}>Track Your Order</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "3rem" }}>
          Order for <strong>{auction.title}</strong>
        </p>

        {/* Timeline */}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: "4rem" }}>
          {/* Connecting Line */}
          <div style={{
            position: "absolute",
            top: "24px",
            left: "10%",
            right: "10%",
            height: "4px",
            background: "var(--border)",
            zIndex: 1
          }}>
            <div style={{
              height: "100%",
              background: "var(--accent)",
              width: `${(currentStatusIndex / (STAGES.length - 1)) * 100}%`,
              transition: "width 0.5s ease"
            }} />
          </div>

          {STAGES.map((stage, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            
            return (
              <div key={stage.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, width: "25%" }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: isCompleted ? "var(--accent)" : "var(--bg-secondary)",
                  border: `2px solid ${isCompleted ? "var(--accent)" : "var(--border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  marginBottom: "10px",
                  color: isCompleted ? "#fff" : "var(--text-muted)",
                  boxShadow: isCurrent ? "0 0 15px var(--accent-glow)" : "none",
                  transition: "all 0.3s ease"
                }}>
                  {stage.icon}
                </div>
                <div style={{
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? "var(--accent)" : isCompleted ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: "0.9rem"
                }}>
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Delivery Details */}
        {auction.deliveryDetails && (
          <div style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "12px", textAlign: "left", marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "var(--text-primary)" }}>Delivery Address</h3>
            <p style={{ color: "var(--text-secondary)", margin: "4px 0" }}>{auction.deliveryDetails.address}</p>
            <p style={{ color: "var(--text-secondary)", margin: "4px 0" }}>{auction.deliveryDetails.city}, {auction.deliveryDetails.pincode}</p>
            <p style={{ color: "var(--text-secondary)", margin: "4px 0" }}>📞 {auction.deliveryDetails.phone}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          {currentStatusIndex < STAGES.length - 1 && (
            <button
              onClick={simulateNextStep}
              disabled={simulating}
              className="btn btn-primary"
            >
              {simulating ? "Updating..." : "Simulate Next Step (Prototype)"}
            </button>
          )}
          <Link to="/my-auctions" className="btn btn-outline">
            Back to My Auctions
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Tracking;
