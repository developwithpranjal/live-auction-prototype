import axios from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token from localStorage to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auction_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// TODO (production): Add response interceptor for refresh token rotation here

export default api;
