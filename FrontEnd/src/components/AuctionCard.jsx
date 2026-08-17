import { Link } from "react-router-dom";
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

const AuctionCard = ({ auction }) => {
  const { _id, title, images, currentPrice, status, startTime, endTime, seller } = auction;

  const firstImage = images && images.length > 0 ? images[0].url : null;

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <Link to={`/auction/${_id}`} className="auction-card fade-in">
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
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="auction-card-footer">
        <span>
          {images?.length > 1 ? `📷 ${images.length} photos` : "📷 1 photo"}
        </span>
        <span>View →</span>
      </div>
    </Link>
  );
};

export default AuctionCard;
