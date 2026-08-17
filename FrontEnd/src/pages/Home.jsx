import { useState, useEffect } from "react";
import AuctionCard from "../components/AuctionCard.jsx";
import api from "../services/api.js";
import "../styles/home.css";

const FILTERS = ["all", "live", "upcoming", "ended"];

const Home = () => {
  const [auctions, setAuctions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        setLoading(true);
        const params = filter !== "all" ? { status: filter } : {};
        const { data } = await api.get("/auctions", { params });
        setAuctions(data.auctions);
      } catch (err) {
        setError("Failed to load auctions. Is the server running?");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuctions();
  }, [filter]);

  const counts = {
    all: auctions.length,
    live: auctions.filter((a) => a.status === "live").length,
    upcoming: auctions.filter((a) => a.status === "upcoming").length,
    ended: auctions.filter((a) => a.status === "ended").length,
  };

  return (
    <>
      {/* Hero Section */}
      <section className="home-hero">
        <div className="container">
          <div className="home-hero-eyebrow">Live Auctions Platform</div>
          <h1 className="home-hero-title">
            Bid. Win. <span>Repeat.</span>
          </h1>
          <p className="home-hero-sub">
            Real-time auctions where every second counts. Join live auctions and
            compete for unique items.
          </p>
        </div>
      </section>

      {/* Auctions Section */}
      <div className="container page" style={{ paddingTop: 0 }}>
        {/* Stats */}
        {!loading && (
          <div className="stats-bar">
            <div className="stat-item">
              <div className="stat-value">{counts.live}</div>
              <div className="stat-label">🔴 Live Now</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{counts.upcoming}</div>
              <div className="stat-label">⏳ Upcoming</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{counts.ended}</div>
              <div className="stat-label">✅ Completed</div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f}
              id={`filter-${f}`}
              className={`filter-tab ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && !loading && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  ({counts[f]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="loading-state">Loading auctions...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : auctions.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔍</div>
            <p>No {filter !== "all" ? filter : ""} auctions found.</p>
            <p style={{ marginTop: 8 }}>
              <a href="/create">Create the first one →</a>
            </p>
          </div>
        ) : (
          <div className="auctions-grid">
            {auctions.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
