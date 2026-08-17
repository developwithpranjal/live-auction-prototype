import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Timer from "../components/Timer.jsx";
import api from "../services/api.js";
import "../styles/auction-detail.css";

// Format currency in INR
const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

// Format relative time for bid history
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

// ── Bid Box Component ──────────────────────────────────────────────────────────
const BidBox = ({ currentPrice, bidIncrement, onBid, disabled, status }) => {
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const minBid = currentPrice + bidIncrement;

  // Auto-fill with minimum valid bid
  useEffect(() => {
    setBidAmount(String(minBid));
  }, [minBid]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      setError(`Minimum bid is ${formatPrice(minBid)}`);
      return;
    }
    setError("");
    onBid(amount);
  };

  if (status === "ended") {
    return (
      <div className="bid-box">
        <p className="bid-box-title">This auction has ended.</p>
      </div>
    );
  }

  if (status === "upcoming") {
    return (
      <div className="bid-box">
        <p className="bid-box-title">⏳ Bidding starts when the auction goes live.</p>
      </div>
    );
  }

  return (
    <form className="bid-box" onSubmit={handleSubmit} id="bid-form">
      <p className="bid-box-title">Place Your Bid</p>
      <div className="bid-box-input-row">
        <input
          id="bid-amount-input"
          type="number"
          className="form-input"
          value={bidAmount}
          onChange={(e) => {
            setBidAmount(e.target.value);
            setError("");
          }}
          min={minBid}
          step={bidIncrement}
          disabled={disabled}
        />
        <button
          id="place-bid-btn"
          type="submit"
          className="btn btn-primary"
          disabled={disabled}
        >
          Bid
        </button>
      </div>
      <p className="bid-box-hint">
        Minimum bid: <strong>{formatPrice(minBid)}</strong> (increment: {formatPrice(bidIncrement)})
      </p>
      {error && <p className="bid-box-error">{error}</p>}
    </form>
  );
};

// ── Main Auction Detail Page ───────────────────────────────────────────────────
const AuctionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bidError, setBidError] = useState("");
  const [outbidAlert, setOutbidAlert] = useState(false);
  const [priceUpdated, setPriceUpdated] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const priceRef = useRef(currentPrice);
  priceRef.current = currentPrice;

  // ── 1. Load auction data on mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchAuction = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/auctions/${id}`);
        setAuction(data.auction);
        setCurrentPrice(data.auction.currentPrice);
        setBids(data.bids || []);
      } catch (err) {
        setError("Failed to load auction. It may not exist.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuction();
  }, [id]);

  // ── 2. Socket.io room management and event listeners ──────────────────────
  useEffect(() => {
    if (!socket || !auction) return;

    const room = `auction:${id}`;

    // Join the auction room
    socket.emit("join_auction", { auctionId: id });

    // If user is logged in, register userId so server can target outbid events
    if (user) {
      socket.emit("authenticate", { userId: user._id });
    }

    // ── bid_update: fired when ANY user in the room places a bid ─────────
    // This is the core real-time event. Update price + prepend to bid history.
    socket.on("bid_update", ({ currentPrice: newPrice, bid }) => {
      setCurrentPrice(newPrice);
      setBids((prev) => [bid, ...prev]);

      // Flash animation on price
      setPriceUpdated(true);
      setTimeout(() => setPriceUpdated(false), 400);
    });

    // ── outbid: fired only to the socket whose userId matches previousBidder
    socket.on("outbid", ({ newAmount, newBidder }) => {
      setOutbidAlert(true);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setOutbidAlert(false), 5000);
    });

    // ── auction_ended: cron broadcasts this when time expires ─────────────
    socket.on("auction_ended", ({ winner, finalPrice }) => {
      setAuction((prev) =>
        prev
          ? {
              ...prev,
              status: "ended",
              winnerId: winner,
              currentPrice: finalPrice,
            }
          : prev
      );
      setCurrentPrice(finalPrice);
    });

    // ── bid_error: server rejected the bid ────────────────────────────────
    socket.on("bid_error", ({ message }) => {
      setBidError(message);
      setTimeout(() => setBidError(""), 5000);
    });

    return () => {
      // Leave room on unmount — stop receiving updates for this auction
      socket.emit("leave_auction", { auctionId: id });
      socket.off("bid_update");
      socket.off("outbid");
      socket.off("auction_ended");
      socket.off("bid_error");
    };
  }, [socket, auction, id, user]);

  // ── 3. Place bid handler ───────────────────────────────────────────────────
  const handleBid = (amount) => {
    if (!user) {
      setBidError("Please log in to place a bid");
      return;
    }
    if (!socket || !socket.connected) {
      setBidError("Not connected to server. Please refresh.");
      return;
    }

    setBidError("");

    // Emit via Socket.io — server handles validation + DB update + broadcast
    socket.emit("place_bid", {
      auctionId: id,
      amount,
      userId: user._id,
      userName: user.name,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading-state">Loading auction...</div>;
  if (error) return <div className="container page"><div className="error-state">{error}</div></div>;
  if (!auction) return null;

  const isWinner =
    auction.status === "ended" &&
    auction.winnerId &&
    user &&
    auction.winnerId._id === user._id;

  const winnerName = auction.winnerId?.name || "Unknown";

  return (
    <div className="container auction-detail">
      {/* Outbid Toast */}
      {outbidAlert && (
        <div className="outbid-toast" role="alert">
          ⚡ You've been outbid! Place a higher bid to stay in the lead.
        </div>
      )}

      {/* Bid Error */}
      {bidError && (
        <div className="outbid-toast" role="alert">
          ❌ {bidError}
        </div>
      )}

      <div className="auction-detail-grid">
        {/* ── Left: Gallery + Description ─────────────────────────────── */}
        <div>
          {/* Gallery */}
          <div className="auction-gallery">
            {auction.images && auction.images.length > 0 ? (
              <>
                <img
                  className="auction-gallery-main"
                  src={auction.images[activeImage].url}
                  alt={auction.title}
                />
                {auction.images.length > 1 && (
                  <div className="auction-gallery-thumbs">
                    {auction.images.map((img, i) => (
                      <div
                        key={i}
                        className={`auction-gallery-thumb ${activeImage === i ? "active" : ""}`}
                        onClick={() => setActiveImage(i)}
                        role="button"
                        tabIndex={0}
                      >
                        <img src={img.url} alt={`Thumbnail ${i + 1}`} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="auction-gallery-placeholder">🏷️</div>
            )}
          </div>

          {/* Description */}
          <div className="auction-description" style={{ marginTop: 20 }}>
            <h3>About This Item</h3>
            <p>{auction.description || "No description provided."}</p>
          </div>
        </div>

        {/* ── Right: Info Panel ────────────────────────────────────────── */}
        <div className="auction-info">
          {/* Header */}
          <div className="auction-info-header">
            <span className={`badge badge-${auction.status}`}>
              {auction.status === "live" && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--live-color)", display: "inline-block", marginRight: 4 }} />
              )}
              {auction.status}
            </span>
            <h1 className="auction-info-title">{auction.title}</h1>
            <p className="auction-info-meta">
              Listed by <strong>{auction.seller?.name}</strong> ·{" "}
              Ends {new Date(auction.endTime).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Winner Banner */}
          {auction.status === "ended" && (
            <div className="winner-banner">
              <div className="winner-banner-emoji">🏆</div>
              <div className="winner-banner-title">
                {isWinner ? "🎉 You Won!" : `Auction Ended`}
              </div>
              <div className="winner-banner-sub">
                {isWinner
                  ? `Congratulations! You won with a bid of ${formatPrice(currentPrice)}`
                  : auction.winnerId
                  ? `Winner: ${winnerName} · Final price: ${formatPrice(currentPrice)}`
                  : "No bids were placed"}
              </div>
              {/* TODO (production): Add payment flow here (Razorpay/Stripe) */}
            </div>
          )}

          {/* Current Price */}
          <div className="auction-price-panel">
            <p className="auction-price-label">
              {auction.status === "ended" ? "Final Price" : "Current Bid"}
            </p>
            <p className={`auction-price-value ${priceUpdated ? "updated" : ""}`}>
              {formatPrice(currentPrice)}
            </p>
            <p className="auction-price-increment">
              Bid increment: {formatPrice(auction.bidIncrement)}
            </p>
          </div>

          {/* Timer */}
          <div className="auction-timer-panel">
            <p className="auction-timer-label">
              {auction.status === "upcoming"
                ? "Auction Starts In"
                : auction.status === "live"
                ? "Time Remaining"
                : "Auction Ended"}
            </p>
            <Timer
              endTime={auction.endTime}
              startTime={auction.startTime}
              status={auction.status}
            />
          </div>

          {/* Bid Box */}
          <BidBox
            currentPrice={currentPrice}
            bidIncrement={auction.bidIncrement}
            onBid={handleBid}
            disabled={auction.status !== "live" || !user}
            status={auction.status}
          />

          {!user && auction.status === "live" && (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
              <a href="/login">Log in</a> to place a bid
            </p>
          )}
        </div>

        {/* ── Bid History (full width) ─────────────────────────────────── */}
        <div className="bid-history">
          <div className="bid-history-header">
            📋 Bid History
            <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: "auto" }}>
              {bids.length} bid{bids.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="bid-history-list">
            {bids.length === 0 ? (
              <div className="bid-history-empty">
                No bids yet. Be the first to bid!
              </div>
            ) : (
              bids.map((bid, i) => {
                const isMyBid = user && bid.bidder?._id === user._id;
                const name = bid.bidder?.name || "Unknown";
                return (
                  <div
                    key={bid._id || i}
                    className={`bid-history-item ${isMyBid ? "mine" : ""}`}
                  >
                    <div className="bid-history-bidder">
                      <div className="bid-history-avatar">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="bid-history-name">
                          {name} {isMyBid && "(You)"}
                          {i === 0 && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "var(--success)" }}>● Highest</span>}
                        </div>
                        <div className="bid-history-time">
                          {timeAgo(bid.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="bid-history-amount">
                      {formatPrice(bid.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionDetail;
