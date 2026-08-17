import { io } from "socket.io-client";

let socket = null;

/**
 * Get or create the Socket.io connection.
 * Using a singleton pattern so we don't create multiple connections
 * if components mount/unmount rapidly.
 */
export const getSocket = () => {
  if (!socket) {
    socket = io("http://localhost:5000", {
      autoConnect: false, // We connect manually after auth
      withCredentials: true,
    });
  }
  return socket;
};

export const connectSocket = (token) => {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token };
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};
