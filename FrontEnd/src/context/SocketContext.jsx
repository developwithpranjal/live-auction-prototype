import { createContext, useContext, useEffect, useState } from "react";
import { getSocket, connectSocket } from "../services/socket.js";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (user && token) {
      const s = connectSocket(token);
      setSocket(s);

      s.on("connect", () => {
        console.log("✅ Socket connected:", s.id);
      });

      s.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
      });
    } else {
      // Not logged in — just expose the socket instance (not connected)
      setSocket(getSocket());
    }
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};
