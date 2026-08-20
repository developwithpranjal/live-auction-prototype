import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api.js";
import { useAuth } from "./AuthContext.jsx";
import toast from "react-hot-toast";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setCartItems([]); // Clear cart when logged out
    }
  }, [user]);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/cart");
      setCartItems(data.cart.items || []);
    } catch (err) {
      console.error("Failed to fetch cart", err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (auctionId) => {
    if (!user) {
      toast.error("Please log in to add items to cart");
      return false;
    }
    
    try {
      const { data } = await api.post(`/cart/${auctionId}`);
      setCartItems(data.cart.items);
      toast.success("Added to cart");
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add to cart");
      return false;
    }
  };

  const removeFromCart = async (auctionId) => {
    if (!user) return false;

    try {
      const { data } = await api.delete(`/cart/${auctionId}`);
      setCartItems(data.cart.items);
      toast.success("Removed from cart");
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove from cart");
      return false;
    }
  };

  const isInCart = (auctionId) => {
    return cartItems.some((item) => item.auction?._id === auctionId || item.auction === auctionId);
  };

  return (
    <CartContext.Provider value={{ cartItems, loading, fetchCart, addToCart, removeFromCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
