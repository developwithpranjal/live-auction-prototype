import { useState, useEffect } from "react";

/**
 * Countdown timer component.
 * Shows HH:MM:SS remaining or "Auction Ended" / "Starting Soon".
 * Turns urgent (red pulse) when < 60 seconds remain.
 */
const Timer = ({ endTime, startTime, status }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculate = () => {
      const now = new Date();

      if (status === "ended") {
        setTimeLeft("Auction Ended");
        setIsUrgent(false);
        return;
      }

      if (status === "upcoming") {
        const diff = new Date(startTime) - now;
        if (diff <= 0) {
          setTimeLeft("Starting...");
          return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(
          `Starts in ${h > 0 ? `${h}h ` : ""}${m}m ${s}s`
        );
        return;
      }

      // Live auction
      const diff = new Date(endTime) - now;
      if (diff <= 0) {
        setTimeLeft("Ending...");
        setIsUrgent(true);
        return;
      }

      setIsUrgent(diff < 60000); // Urgent when < 60 seconds

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const parts = [];
      if (h > 0) parts.push(String(h).padStart(2, "0"));
      parts.push(String(m).padStart(2, "0"));
      parts.push(String(s).padStart(2, "0"));

      setTimeLeft(parts.join(":"));
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endTime, startTime, status]);

  return (
    <span className={`auction-timer-display ${isUrgent ? "urgent" : ""}`}>
      {timeLeft}
    </span>
  );
};

export default Timer;
