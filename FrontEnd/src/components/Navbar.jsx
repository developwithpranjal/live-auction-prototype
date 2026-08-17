import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
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
              <div className="navbar-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="navbar-username">{user.name}</span>
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
