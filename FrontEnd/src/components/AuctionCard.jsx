import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import api from "../services/api.js";
import Timer from "./Timer.jsx";

const StatusBadge = ({ status }) => {
  const classMap = {
    live: "badge badge-live",
    upcoming: "badge badge-upcoming",
    ended: "badge badge-ended",
  };

  return (
    <span className={classMap[status] || "badge"}>
      {status}
    </span>
  );
};

const AuctionCard = ({ auction, serverTime }) => {
  const { user, updateUserSession } = useAuth();
  const { isInCart, addToCart, removeFromCart } = useCart();
  const { _id, title, images, currentPrice, status, startTime, endTime, seller } = auction;

  const [loading, setLoading] = useState(false);
  const isWishlisted = user?.wishlist?.includes(_id) || false;

  const handleWishlistToggle = async (e) => {
    e.preventDefault(); // Prevent navigating to AuctionDetail
    e.stopPropagation();
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await api.post("/users/wishlist", { auctionId: _id });
      updateUserSession({ wishlist: data.wishlist });
    } catch (err) {
      console.error("Failed to toggle wishlist", err);
    } finally {
      setLoading(false);
    }
  };

  const firstImage = images && images.length > 0 ? images[0].url : null;

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const inCart = isInCart(_id);

  const handleCartToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      await removeFromCart(_id);
    } else {
      await addToCart(_id);
    }
  };

  return (
    <Link to={`/auction/${_id}`} className="auction-card fade-in" style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Image */}
      <div className="auction-card-image">
        {firstImage ? (
          <img src={firstImage} alt={title} loading="lazy" />
        ) : (
          <div className="auction-card-image-placeholder">🏷️</div>
        )}
        <div className="auction-card-badge">
          <StatusBadge status={status} />
        </div>
        {user && (
          <button
            onClick={handleWishlistToggle}
            disabled={loading}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "rgba(255,255,255,0.8)",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 2,
              fontSize: "1.2rem",
              transition: "transform 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
            title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          >
            {isWishlisted ? "❤️" : "🤍"}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="auction-card-body">
        <h3 className="auction-card-title">{title}</h3>
        <p className="auction-card-seller">by {seller?.name || "Unknown"}</p>

        <div className="auction-card-price">
          <div>
            <p className="auction-card-price-label">
              {status === "ended" ? "Final Price" : "Current Bid"}
            </p>
            <p className="auction-card-price-value">{formatPrice(currentPrice)}</p>
          </div>
          {status !== "ended" && (
            <div
              className="auction-card-timer"
              title={status === "live" ? "Time remaining" : "Starts in"}
            >
              <Timer
                endTime={endTime}
                startTime={startTime}
                status={status}
                serverTime={serverTime}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="auction-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          {images?.length > 1 ? `📷 ${images.length} photos` : "📷 1 photo"}
        </span>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {user && status !== "ended" && (
            <button
              onClick={handleCartToggle}
              style={{
                background: "transparent",
                border: "none",
                color: inCart ? "var(--success)" : "var(--accent)",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
                padding: 0
              }}
            >
              {inCart ? "✓ In Cart" : "🛒 Add to Cart"}
            </button>
          )}
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>View →</span>
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;
