import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api.js";
import { connectSocket, disconnectSocket } from "../services/socket.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // true on initial load

  // Restore session from localStorage on app start
  useEffect(() => {
    const storedToken = localStorage.getItem("auction_token");
    const storedUser = localStorage.getItem("auction_user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      connectSocket(storedToken);
    }
    setLoading(false);
  }, []);

  const _saveSession = (userData, tokenValue) => {
    setUser(userData);
    setToken(tokenValue);
    localStorage.setItem("auction_token", tokenValue);
    localStorage.setItem("auction_user", JSON.stringify(userData));
    connectSocket(tokenValue);
  };

  const signup = async (name, email, password, role) => {
    const { data } = await api.post("/auth/signup", {
      name,
      email,
      password,
      role,
    });
    _saveSession(data.user, data.token);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    _saveSession(data.user, data.token);
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auction_token");
    localStorage.removeItem("auction_user");
    disconnectSocket();
  };

  const refreshWallet = async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/wallet/balance");
      const updatedUser = { ...user, walletBalance: data.balance };
      setUser(updatedUser);
      localStorage.setItem("auction_user", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("Failed to fetch wallet balance", err);
    }
  };

  const updateUserSession = (updatedUser) => {
    setUser({ ...user, ...updatedUser });
    localStorage.setItem("auction_user", JSON.stringify({ ...user, ...updatedUser }));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout, refreshWallet, updateUserSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
