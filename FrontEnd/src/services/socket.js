import { io } from "socket.io-client";

/**
 * Socket.io singleton — persists across Vite HMR reloads in dev.
 * In dev, Vite re-executes modules on save which would destroy `let socket`
 * and create a new connection every time. We store the instance on
 * `import.meta.hot.data` so HMR preserves it between reloads.
 */

// Restore socket from HMR data if available (dev only)
let socket = import.meta.hot?.data?.socket ?? null;

export const getSocket = () => {
  if (!socket) {
    socket = io(`${import.meta.env.VITE_API_BASE_URL}`, {
      autoConnect: false, // We connect manually after auth
      withCredentials: true,
    });
  }

  // Persist socket across HMR updates in dev
  if (import.meta.hot) {
    import.meta.hot.data.socket = socket;
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
