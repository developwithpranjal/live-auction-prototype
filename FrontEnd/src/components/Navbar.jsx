import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Wallet from "./Wallet.jsx";
import "../styles/navbar.css";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-icon">🔨</div>
          <span className="navbar-logo-text">
            Bid<span>Wave</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="navbar-links">
          <Link
            to="/"
            className={`navbar-link ${isActive("/") ? "active" : ""}`}
          >
            Browse
          </Link>

          {user && (
            <>
              <Link
                to="/my-auctions"
                className={`navbar-link ${isActive("/my-auctions") ? "active" : ""}`}
              >
                My Auctions
              </Link>
              <Link
                to="/create"
                className={`navbar-link ${isActive("/create") ? "active" : ""}`}
              >
                + Create
              </Link>
            </>
          )}
        </div>

        {/* Auth Section */}
        <div className="navbar-user">
          {user ? (
            <>
              <Wallet />
              <Link to="/profile" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }} className="profile-link">
                <div className="navbar-avatar" style={{ cursor: "pointer", transition: "transform 0.2s", overflow: "hidden" }} onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}>
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="navbar-username" style={{ cursor: "pointer" }}>{user.name}</span>
              </Link>
              <button
                id="navbar-logout-btn"
                onClick={handleLogout}
                className="btn btn-outline btn-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Login
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
