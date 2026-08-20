import { useCart } from "../context/CartContext.jsx";
import AuctionCard from "../components/AuctionCard.jsx";
import "../styles/home.css"; // Reuse home layout styles for grid

const Cart = () => {
  const { cartItems, loading, removeFromCart } = useCart();

  return (
    <div className="container page">
      <div style={{ marginBottom: "30px", borderBottom: "1px solid var(--border)", paddingBottom: "20px" }}>
        <h1 style={{ fontSize: "2rem" }}>My Cart 🛒</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "10px" }}>
          Your saved items for quick access and checkout.
        </p>
      </div>

      {loading ? (
        <div className="loading-state">Loading cart...</div>
      ) : cartItems.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🛒</div>
          <p>Your cart is empty.</p>
          <p style={{ marginTop: 8 }}>
            <a href="/">Browse auctions to add some →</a>
          </p>
        </div>
      ) : (
        <div className="auctions-grid">
          {cartItems.map((item) => (
            <div key={item.auction._id} style={{ position: "relative" }}>
              <AuctionCard auction={item.auction} serverTime={Date.now()} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  removeFromCart(item.auction._id);
                }}
                className="btn btn-outline"
                style={{
                  position: "absolute",
                  bottom: "10px",
                  left: "10px",
                  width: "calc(100% - 20px)", // Assuming card is relative
                  background: "var(--bg-card)",
                  color: "var(--danger)",
                  borderColor: "var(--danger)",
                  zIndex: 2,
                }}
              >
                Remove from Cart
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Cart;
