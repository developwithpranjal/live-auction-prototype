import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import toast from "react-hot-toast";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price || 0);

const Wallet = () => {
  const { user, refreshWallet } = useAuth();
  const [amount, setAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddFunds = async (e) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      await api.post("/wallet/add", { amount: val });
      await refreshWallet();
      toast.success(`Successfully added ${formatPrice(val)}`);
      setAmount("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to add funds");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="wallet-container" style={{ position: "relative", marginRight: "1rem" }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-outline btn-sm"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <span>💰</span>
        <span>{formatPrice(user.walletBalance)}</span>
      </button>

      {isOpen && (
        <div 
          className="wallet-dropdown"
          style={{
            position: "absolute",
            top: "120%",
            right: 0,
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "1rem",
            width: "250px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100
          }}
        >
          <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>Add Dummy Funds</h4>
          <form onSubmit={handleAddFunds} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input 
              type="number" 
              className="form-input" 
              placeholder="Amount (₹)" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "Adding..." : "Add to Wallet"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Wallet;
