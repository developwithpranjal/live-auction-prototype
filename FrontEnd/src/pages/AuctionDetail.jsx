import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import Timer from "../components/Timer.jsx";
import api from "../services/api.js";
import toast from "react-hot-toast";
import "../styles/auction-detail.css";

// Format currency in INR
const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

// ── Bid Box Component ──────────────────────────────────────────────────────────
const BidBox = ({ currentPrice, bidIncrement, onBid, disabled, status, user }) => {
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const minBid = currentPrice + bidIncrement;
  
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

  if (status === "ended") return <div className="bid-box"><p className="bid-box-title">This auction has ended.</p></div>;
  if (status === "upcoming") return <div className="bid-box"><p className="bid-box-title">⏳ Bidding starts when the auction goes live.</p></div>;

  return (
    <form className="bid-box" onSubmit={handleSubmit} id="bid-form">
      <p className="bid-box-title">Place Your Bid</p>
      <div className="bid-box-input-row">
        <input type="number" className="form-input" value={bidAmount} onChange={(e) => { setBidAmount(e.target.value); setError(""); }} min={minBid} step={bidIncrement} disabled={disabled} />
        <button type="submit" className="btn btn-primary" disabled={disabled}>Bid</button>
      </div>
      <p className="bid-box-hint">Minimum bid: <strong>{formatPrice(minBid)}</strong> (increment: {formatPrice(bidIncrement)})</p>
      {user && (
        <p className="bid-box-hint" style={{ marginTop: 8 }}>
          Wallet Balance: <strong>{formatPrice(user.walletBalance)}</strong>
          {user.walletBalance < minBid && <span style={{ color: "var(--danger)", display: "block", marginTop: 4 }}>Insufficient funds. Add money to your wallet to bid.</span>}
        </p>
      )}
      {error && <p className="bid-box-error">{error}</p>}
    </form>
  );
};

// ── Offer Box Component ────────────────────────────────────────────────────────
const OfferBox = ({ startPrice, onOffer, disabled, status, user }) => {
  const minOffer = startPrice * 1.3;
  const [offerAmount, setOfferAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(offerAmount);
    if (isNaN(amount) || amount < minOffer) {
      setError(`Minimum offer is ${formatPrice(minOffer)}`);
      return;
    }
    setError("");
    setLoading(true);
    await onOffer(amount);
    setLoading(false);
    setOfferAmount("");
  };

  if (status !== "live") return null;

  return (
    <form className="bid-box" style={{ marginTop: "1rem" }} onSubmit={handleSubmit}>
      <p className="bid-box-title">Make an Offer</p>
      <div className="bid-box-input-row">
        <input type="number" className="form-input" value={offerAmount} onChange={(e) => { setOfferAmount(e.target.value); setError(""); }} min={minOffer} disabled={disabled || loading} placeholder={`Min: ₹${minOffer.toFixed(0)}`} />
        <button type="submit" className="btn btn-outline" disabled={disabled || loading}>Offer</button>
      </div>
      <p className="bid-box-hint">Minimum offer: <strong>{formatPrice(minOffer)}</strong> (30% above start price)</p>
      {error && <p className="bid-box-error">{error}</p>}
    </form>
  );
};

// ── Main Auction Detail Page ───────────────────────────────────────────────────
const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUserSession } = useAuth();
  const { socket } = useSocket();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverTime, setServerTime] = useState(null);
  const [bidError, setBidError] = useState("");
  const [outbidAlert, setOutbidAlert] = useState(false);
  const [priceUpdated, setPriceUpdated] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  // Offers state
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const [wishlistLoading, setWishlistLoading] = useState(false);
  const isWishlisted = user?.wishlist?.includes(id) || false;

  const { isInCart, addToCart, removeFromCart } = useCart();
  const inCart = isInCart(id);

  const handleWishlistToggle = async () => {
    if (!user) return;
    try {
      setWishlistLoading(true);
      const { data } = await api.post("/users/wishlist", { auctionId: id });
      updateUserSession({ wishlist: data.wishlist });
      toast.success(data.message);
    } catch (err) {
      toast.error("Failed to update wishlist");
    } finally {
      setWishlistLoading(false);
    }
  };

  // ── WebRTC & Chat State ──────────────────────────────────────────────────────
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [chats, setChats] = useState([]);
  const [chatInput, setChatInput] = useState("");
  
  const videoRef = useRef(null);
  const localStreamRef = useRef(null); // Holds seller's camera stream
  const peerConnections = useRef({}); // For Seller (1 to many)
  const viewerPC = useRef(null); // For Buyer (1 connection to seller)
  
  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };

  const isSeller = user && auction && auction.seller && 
    (typeof auction.seller === 'string' ? auction.seller === user._id : auction.seller._id === user._id);

  const fetchAuction = async () => {
    try {
      // Don't set loading to true on refresh so it doesn't flicker
      if (!auction) setLoading(true);
      const { data } = await api.get(`/auctions/${id}`);
      setAuction(data.auction);
      setCurrentPrice(data.auction.currentPrice);
      setBids(data.bids || []);
      setServerTime(data.serverTime);
    } catch (err) {
      setError("Failed to load auction. It may not exist.");
    } finally {
      setLoading(false);
    }
  };

  // ── 1. Load auction data ──────────────────────────────────────────
  useEffect(() => {
    fetchAuction();
  }, [id]);

  useEffect(() => {
    if (isSeller && auction && auction.status === "live") {
      const fetchOffers = async () => {
        try {
          setOffersLoading(true);
          const { data } = await api.get(`/offers/${id}`);
          setOffers(data.offers || []);
        } catch (err) {
          console.error("Failed to fetch offers");
        } finally {
          setOffersLoading(false);
        }
      };
      fetchOffers();
    }
  }, [isSeller, auction, id]);

  const handleMakeOffer = async (amount) => {
    if (!user) return toast.error("Please log in to make an offer");
    try {
      await api.post("/offers", { auctionId: id, amount });
      toast.success("Offer submitted successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit offer");
    }
  };

  const handleRespondOffer = async (offerId, action) => {
    try {
      await api.put(`/offers/${offerId}/respond`, { action });
      toast.success(`Offer ${action}ed successfully`);
      if (action === "accept") {
        fetchAuction(); // Refresh auction to see ended status
      } else {
        setOffers(offers.filter(o => o._id !== offerId));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} offer`);
    }
  };

  // ── 2. Socket.io Bidding Logic ──────────────────────
  useEffect(() => {
    if (!socket || !auction) return;

    socket.emit("join_auction", { auctionId: id });
    if (user) socket.emit("authenticate", { userId: user._id });

    socket.on("bid_update", ({ currentPrice: newPrice, bid }) => {
      setCurrentPrice(newPrice);
      setBids((prev) => [bid, ...prev]);
      setPriceUpdated(true);
      setTimeout(() => setPriceUpdated(false), 400);
    });

    socket.on("outbid", () => {
      setOutbidAlert(true);
      setTimeout(() => setOutbidAlert(false), 5000);
    });

    socket.on("auction_ended", ({ winner, finalPrice }) => {
      setAuction((prev) => prev ? { ...prev, status: "ended", winnerId: winner, currentPrice: finalPrice } : prev);
      setCurrentPrice(finalPrice);
      stopLiveStream();
    });

    socket.on("bid_error", ({ message }) => {
      setBidError(message);
      setTimeout(() => setBidError(""), 5000);
    });

    return () => {
      socket.emit("leave_auction", { auctionId: id });
      socket.off("bid_update");
      socket.off("outbid");
      socket.off("auction_ended");
      socket.off("bid_error");
    };
  }, [socket, auction, id, user]);

  // ── 3. Chat Logic ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    
    socket.on("chat_message", (chatData) => {
      setChats(prev => [...prev, chatData]);
    });

    return () => {
      socket.off("chat_message");
    };
  }, [socket]);

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    socket.emit("chat_message", { auctionId: id, message: chatInput, user: user.name });
    setChatInput("");
  };

  // ── 4. WebRTC Signaling Logic ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !auction) return;

    // A. SELLER LOGIC (Broadcaster)
    if (isSeller) {
      socket.on("viewer_joined", async (viewerId) => {
        if (!localStreamRef.current) return; // Not streaming yet
        
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[viewerId] = pc;

        // Add local tracks to this peer connection
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice_candidate", { auctionId: id, targetId: viewerId, candidate: event.candidate });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { auctionId: id, viewerId, offer });
      });

      socket.on("answer", async ({ viewerId, answer }) => {
        const pc = peerConnections.current[viewerId];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("ice_candidate", async ({ senderId, candidate }) => {
        const pc = peerConnections.current[senderId];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
    } 
    // B. BUYER LOGIC (Viewer)
    else {
      // Announce we are a viewer looking for a stream
      socket.emit("viewer_joined", { auctionId: id });

      socket.on("broadcaster_ready", () => {
        // Stream just started, tell them we are here
        socket.emit("viewer_joined", { auctionId: id });
      });

      socket.on("offer", async ({ broadcasterId, offer }) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        viewerPC.current = pc;

        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            setIsStreaming(true);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice_candidate", { auctionId: id, targetId: broadcasterId, candidate: event.candidate });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { auctionId: id, broadcasterId, answer });
      });

      socket.on("ice_candidate", async ({ senderId, candidate }) => {
        const pc = viewerPC.current;
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
    }

    return () => {
      socket.off("viewer_joined");
      socket.off("broadcaster_ready");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice_candidate");
    };
  }, [socket, auction, id, isSeller]);

  // ── 5. Start/Stop Stream (Seller Only) ───────────────────────────────────
  const startLiveStream = async () => {
    try {
      setStreamError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      
      // Tell signaling server we are ready
      socket.emit("broadcaster_joined", { auctionId: id });
    } catch (err) {
      console.error("Camera access denied or failed", err);
      setStreamError("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const stopLiveStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setIsStreaming(false);
    
    // Close all seller peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    
    // Close buyer peer connection
    if (viewerPC.current) {
      viewerPC.current.close();
      viewerPC.current = null;
    }
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => stopLiveStream();
  }, []);

  const handleBid = (amount) => {
    if (!user) return setBidError("Please log in to place a bid");
    if (!socket || !socket.connected) return setBidError("Not connected to server. Please refresh.");
    setBidError("");
    socket.emit("place_bid", { auctionId: id, amount, userId: user._id, userName: user.name });
  };

  const handleEndAuctionEarly = async () => {
    if (!window.confirm("Are you sure you want to end this auction early? The current highest bidder will win immediately.")) return;
    try {
      await api.put(`/auctions/${id}/end`);
      toast.success("Auction ended early successfully!");
      // The socket event "auction_ended" will be broadcasted and caught by the useEffect to update UI automatically
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to end auction early");
    }
  };

  const handleDeleteAuction = async () => {
    if (!window.confirm("Are you sure you want to completely delete this upcoming auction? This action cannot be undone.")) return;
    try {
      await api.delete(`/auctions/${id}`);
      toast.success("Auction deleted successfully!");
      navigate("/my-auctions");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete auction");
    }
  };

  if (loading) return <div className="loading-state">Loading auction...</div>;
  if (error) return <div className="container page"><div className="error-state">{error}</div></div>;
  if (!auction) return null;

  const isWinner = auction.status === "ended" && auction.winnerId && user && auction.winnerId._id === user._id;

  return (
    <div className="container auction-detail">
      {outbidAlert && <div className="outbid-toast" role="alert">⚡ You've been outbid! Place a higher bid to stay in the lead.</div>}
      {bidError && <div className="outbid-toast" role="alert">❌ {bidError}</div>}

      <div className="auction-detail-grid">
        {/* ── Left: Video/Gallery + Description ─────────────────────────────── */}
        <div>
          {/* Live Video Stream (if live) */}
          {auction.status === "live" && (
            <div className="live-stream-container" style={{ marginBottom: "1rem", position: "relative", borderRadius: "12px", overflow: "hidden", border: "2px solid var(--accent)", boxShadow: "0 4px 15px rgba(162, 203, 139, 0.2)", background: "#000", aspectRatio: "16/9" }}>
              <div style={{ position: "absolute", top: 10, left: 10, background: "var(--live-bg)", color: "white", padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold", zIndex: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="pulsing-dot" style={{ width: 8, height: 8, background: "white", borderRadius: "50%", display: "inline-block" }}></span>
                LIVE
              </div>

              {!isStreaming && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 20, color: "white", pointerEvents: "none" }}>
                  {isSeller ? (
                    <>
                      <p style={{ marginBottom: 15 }}>You are the seller. Ready to go live?</p>
                      <button onClick={startLiveStream} className="btn btn-primary" style={{ background: "var(--live-bg)", border: "none", pointerEvents: "auto" }}>📸 Start Live Stream</button>
                      {streamError && <p style={{ color: "var(--danger)", marginTop: 10, fontSize: "0.85rem" }}>{streamError}</p>}
                    </>
                  ) : (
                    <p>Waiting for seller to start the live stream...</p>
                  )}
                </div>
              )}

              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                muted={isSeller} // Mute for broadcaster to prevent echo
                style={{ width: "100%", height: "100%", objectFit: "cover", display: isStreaming ? "block" : "none" }}
              />

              {/* Instagram-style Chat Overlay */}
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "50%", background: "linear-gradient(transparent, rgba(0,0,0,0.8))", zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "10px", pointerEvents: "none" }}>
                
                {/* Chat Messages */}
                <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px", maxHeight: "150px", pointerEvents: "auto" }} className="hide-scrollbar">
                  {chats.map((c, i) => (
                    <div key={i} style={{ color: "white", fontSize: "0.85rem", textShadow: "1px 1px 2px black" }}>
                      <span style={{ fontWeight: 600, marginRight: 5, color: "var(--accent)" }}>{c.user}</span>
                      <span>{c.message}</span>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <form onSubmit={sendChat} style={{ display: "flex", gap: "5px", pointerEvents: "auto" }}>
                  <input 
                    type="text" 
                    placeholder={user ? "Add a comment..." : "Login to chat..."}
                    disabled={!user}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    style={{ flex: 1, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "20px", padding: "8px 15px", color: "white", outline: "none", fontSize: "0.85rem" }}
                  />
                  <button type="submit" disabled={!user} style={{ background: "transparent", border: "none", color: "white", fontWeight: "bold", padding: "0 10px", cursor: user ? "pointer" : "not-allowed" }}>
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Gallery */}
          <div className="auction-gallery">
            {auction.images && auction.images.length > 0 ? (
              <>
                <img className="auction-gallery-main" src={auction.images[activeImage].url} alt={auction.title} />
                {auction.images.length > 1 && (
                  <div className="auction-gallery-thumbs">
                    {auction.images.map((img, i) => (
                      <div key={i} className={`auction-gallery-thumb ${activeImage === i ? "active" : ""}`} onClick={() => setActiveImage(i)}>
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
              {auction.status === "live" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--live-color)", display: "inline-block", marginRight: 4 }} />}
              {auction.status}
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
              <h1 className="auction-info-title" style={{ margin: 0 }}>{auction.title}</h1>
              <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                {user && auction.status !== "ended" && !isSeller && (
                  <button
                    onClick={() => inCart ? removeFromCart(id) : addToCart(id)}
                    style={{
                      background: "var(--bg-card)",
                      border: `1px solid ${inCart ? "var(--success)" : "var(--border)"}`,
                      borderRadius: "8px",
                      padding: "0 12px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: inCart ? "var(--success)" : "var(--text-primary)",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = inCart ? "var(--success)" : "var(--accent)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = inCart ? "var(--success)" : "var(--border)"; }}
                  >
                    {inCart ? "✓ In Cart" : "🛒 Add to Cart"}
                  </button>
                )}
                {user && (
                  <button
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "50%",
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "1.2rem",
                      transition: "transform 0.2s, border-color 0.2s",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                    title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    {isWishlisted ? "❤️" : "🤍"}
                  </button>
                )}
              </div>
            </div>
            <p className="auction-info-meta">
              Listed by <strong>{auction.seller?.name || "Unknown"}</strong> · Ends {new Date(auction.endTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          {/* Winner Banner */}
          {auction.status === "ended" && (
            <div className="winner-banner">
              <div className="winner-banner-emoji">🏆</div>
              <div className="winner-banner-title">{isWinner ? "🎉 You Won!" : `Auction Ended`}</div>
              <div className="winner-banner-sub">
                {isWinner ? `Congratulations! You won with a bid of ${formatPrice(currentPrice)}` : auction.winnerId ? `Winner: ${auction.winnerId.name || "Unknown"} · Final price: ${formatPrice(currentPrice)}` : "No bids were placed"}
              </div>
              {isWinner && !auction.isPaid && (
                <button onClick={() => navigate(`/checkout/${id}`)} className="btn btn-primary" style={{ marginTop: "1rem", width: "100%", background: "var(--success)" }}>
                  Pay {formatPrice(currentPrice)} to Checkout
                </button>
              )}
              {isWinner && auction.isPaid && (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ padding: "1rem", background: "rgba(162, 203, 139, 0.1)", border: "1px solid var(--accent)", borderRadius: "var(--radius-md)", color: "var(--accent)", textAlign: "center", fontWeight: 600 }}>🎉 You have paid for this item!</div>
                  <button onClick={() => navigate(`/track/${id}`)} className="btn btn-primary" style={{ width: "100%" }}>Track Your Order</button>
                </div>
              )}
            </div>
          )}

          <div className="auction-price-panel">
            <p className="auction-price-label">{auction.status === "ended" ? "Final Price" : "Current Bid"}</p>
            <p className={`auction-price-value ${priceUpdated ? "updated" : ""}`}>{formatPrice(currentPrice)}</p>
            <p className="auction-price-increment">Bid increment: {formatPrice(auction.bidIncrement)}</p>
          </div>

          <div className="auction-timer-panel">
            <p className="auction-timer-label">{auction.status === "upcoming" ? "Auction Starts In" : auction.status === "live" ? "Time Remaining" : "Auction Ended"}</p>
            <Timer endTime={auction.endTime} startTime={auction.startTime} status={auction.status} serverTime={serverTime} onStateChange={fetchAuction} />
          </div>

          <BidBox
            currentPrice={currentPrice}
            bidIncrement={auction.bidIncrement}
            onBid={handleBid}
            disabled={auction.status !== "live" || !user || isSeller || (user && user.walletBalance < currentPrice + auction.bidIncrement)}
            status={auction.status}
            user={user}
          />

          {!isSeller && auction.status === "live" && user && (
            <OfferBox
              startPrice={auction.startPrice}
              onOffer={handleMakeOffer}
              disabled={false}
              status={auction.status}
              user={user}
            />
          )}

          {isSeller && auction.status === "live" && (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ textAlign: "center", padding: "15px", border: "1px dashed var(--danger)", borderRadius: "8px", background: "rgba(239, 68, 68, 0.05)" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: "600", marginBottom: "15px" }}>You are the seller of this item. You cannot bid on it.</p>
                <button 
                  onClick={handleEndAuctionEarly} 
                  className="btn btn-outline" 
                  style={{ width: "100%", borderColor: "var(--danger)", color: "var(--danger)" }}
                >
                  Close Auction Early
                </button>
              </div>

              {/* View Offers Section for Seller */}
              <div style={{ marginTop: "1.5rem", padding: "15px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
                <h4 style={{ margin: "0 0 10px 0" }}>Pending Offers</h4>
                {offersLoading ? (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading offers...</p>
                ) : offers.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No pending offers yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {offers.map(offer => (
                      <div key={offer._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "rgba(0,0,0,0.03)", borderRadius: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{formatPrice(offer.amount)}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>by {offer.buyer?.name}</div>
                        </div>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button onClick={() => handleRespondOffer(offer._id, "accept")} style={{ background: "var(--success)", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>Accept</button>
                          <button onClick={() => handleRespondOffer(offer._id, "reject")} style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {isSeller && auction.status === "upcoming" && (
            <div style={{ marginTop: "1rem", textAlign: "center", padding: "15px", border: "1px dashed var(--danger)", borderRadius: "8px", background: "rgba(239, 68, 68, 0.05)" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: "600", marginBottom: "15px" }}>You are the seller of this item. It has not started yet.</p>
              <button 
                onClick={handleDeleteAuction} 
                className="btn btn-outline" 
                style={{ width: "100%", borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                Delete Auction
              </button>
            </div>
          )}
          {!user && auction.status === "live" && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", marginTop: "10px" }}><a href="/login" style={{ color: "var(--accent)" }}>Log in</a> to place a bid</p>}
        </div>

        {/* ── Bid History ─────────────────────────────────── */}
        <div className="bid-history">
          <div className="bid-history-header">📋 Bid History<span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: "auto" }}>{bids.length} bid{bids.length !== 1 ? "s" : ""}</span></div>
          <div className="bid-history-list">
            {bids.length === 0 ? <div className="bid-history-empty">No bids yet. Be the first to bid!</div> : bids.map((bid, i) => {
              const isMyBid = user && bid.bidder?._id === user._id;
              const name = bid.bidder?.name || "Unknown";
              return (
                <div key={bid._id || i} className={`bid-history-item ${isMyBid ? "mine" : ""}`}>
                  <div className="bid-history-bidder">
                    <div className="bid-history-avatar">{name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="bid-history-name">{name} {isMyBid && "(You)"} {i === 0 && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "var(--success)" }}>● Highest</span>}</div>
                      <div className="bid-history-time">{timeAgo(bid.createdAt)}</div>
                    </div>
                  </div>
                  <div className="bid-history-amount">{formatPrice(bid.amount)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionDetail;
