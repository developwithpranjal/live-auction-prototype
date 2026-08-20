import { useState, useEffect, useRef } from "react";

/**
 * Countdown timer component.
 * Shows HH:MM:SS remaining or "Auction Ended" / "Starting Soon".
 * Turns urgent (red pulse) when < 60 seconds remain.
 */
const Timer = ({ endTime, startTime, status, serverTime, onStateChange }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0);
  const stateChangeTriggered = useRef(false);

  useEffect(() => {
    stateChangeTriggered.current = false;
  }, [status]);

  useEffect(() => {
    if (serverTime) {
      // Calculate diff between server time and local time
      const offset = new Date(serverTime).getTime() - Date.now();
      setTimeOffset(offset);
    }
  }, [serverTime]);

  useEffect(() => {
    const calculate = () => {
      // Use offset to get a synchronized 'now'
      const now = new Date(Date.now() + timeOffset);

      if (status === "ended") {
        setTimeLeft("Auction Ended");
        setIsUrgent(false);
        return;
      }

      if (status === "upcoming") {
        const diff = new Date(startTime) - now;
        if (diff <= 0) {
          setTimeLeft("Starting...");
          if (onStateChange && !stateChangeTriggered.current) {
            stateChangeTriggered.current = true;
            onStateChange("live");
          }
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
        if (onStateChange && !stateChangeTriggered.current) {
          stateChangeTriggered.current = true;
          onStateChange("ended");
        }
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
  }, [endTime, startTime, status, timeOffset]);

  return (
    <span className={`auction-timer-display ${isUrgent ? "urgent" : ""}`}>
      {timeLeft}
    </span>
  );
};

export default Timer;
