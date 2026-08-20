import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import AuctionCard from "../components/AuctionCard.jsx";
import "../styles/home.css"; // Reuse home layout styles for grid

const Wishlist = () => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/users/wishlist");
        setWishlist(data.wishlist || []);
      } catch (err) {
        setError("Failed to load wishlist");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchWishlist();
    }
  }, [user]);

  return (
    <div className="container page">
      <div style={{ marginBottom: "30px", borderBottom: "1px solid var(--border)", paddingBottom: "20px" }}>
        <h1 style={{ fontSize: "2rem" }}>My Wishlist ❤️</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "10px" }}>
          Keep track of your favorite auctions.
        </p>
      </div>

      {loading ? (
        <div className="loading-state">Loading wishlist...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : wishlist.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>❤️</div>
          <p>Your wishlist is empty.</p>
          <p style={{ marginTop: 8 }}>
            <a href="/">Browse auctions to add some →</a>
          </p>
        </div>
      ) : (
        <div className="auctions-grid">
          {wishlist.map((auction) => (
            <AuctionCard key={auction._id} auction={auction} serverTime={Date.now()} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
