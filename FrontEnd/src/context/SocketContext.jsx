import { createContext, useContext, useEffect, useState } from "react";
import { getSocket, connectSocket } from "../services/socket.js";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  // Initialize immediately so socket is never null on first render
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(() => {
    const s = getSocket();

    if (user && token) {
      connectSocket(token);
    }

    // Always keep context in sync with the singleton
    setSocket(s);

    const onConnect = () => console.log("✅ Socket connected:", s.id);
    const onConnectError = (err) =>
      console.error("Socket connection error:", err.message);

    s.on("connect", onConnect);
    s.on("connect_error", onConnectError);

    // Clean up listeners on every re-run to prevent accumulation
    return () => {
      s.off("connect", onConnect);
      s.off("connect_error", onConnectError);
    };
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
