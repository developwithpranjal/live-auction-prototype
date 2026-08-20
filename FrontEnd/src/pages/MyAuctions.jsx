import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuctionCard from "../components/AuctionCard.jsx";
import api from "../services/api.js";
import "../styles/create-auction.css";

const MyAuctions = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("listings");
  const [myListings, setMyListings] = useState([]);
  const [biddedAuctions, setBiddedAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverTime, setServerTime] = useState(null);

  useEffect(() => {
    if (!user) return;
    const fetchMyAuctions = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/auctions/my");
        setMyListings(data.myListings);
        setBiddedAuctions(data.biddedAuctions);
        setServerTime(data.serverTime);
      } catch (err) {
        setError("Failed to load your auctions");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyAuctions();
  }, [user]);

  if (!user) {
    return (
      <div className="container page">
        <div className="empty-state">
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔒</div>
          <p>Please <Link to="/login">log in</Link> to see your auctions.</p>
        </div>
      </div>
    );
  }

  const currentList = tab === "listings" ? myListings : biddedAuctions;

  return (
    <div className="container page">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
          My Auctions
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          Manage your listings and track your bids
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="my-auctions-tabs">
        <button
          id="tab-listings-btn"
          className={`my-auctions-tab ${tab === "listings" ? "active" : ""}`}
          onClick={() => setTab("listings")}
        >
          My Listings ({myListings.length})
        </button>
        <button
          id="tab-bids-btn"
          className={`my-auctions-tab ${tab === "bids" ? "active" : ""}`}
          onClick={() => setTab("bids")}
        >
          My Bids ({biddedAuctions.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : currentList.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>
            {tab === "listings" ? "🏷️" : "🤝"}
          </div>
          {tab === "listings" ? (
            <>
              <p>You haven't created any auctions yet.</p>
              <Link
                to="/create"
                className="btn btn-primary"
                style={{ marginTop: 16, display: "inline-flex" }}
              >
                Create Your First Auction
              </Link>
            </>
          ) : (
            <>
              <p>You haven't placed any bids yet.</p>
              <Link
                to="/"
                className="btn btn-primary"
                style={{ marginTop: 16, display: "inline-flex" }}
              >
                Browse Live Auctions
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="auctions-grid">
          {currentList.map((auction) => (
            <AuctionCard key={auction._id} auction={auction} serverTime={serverTime} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAuctions;
