import User from "../Models/User.js";

// @desc    Get user wallet balance
// @route   GET /api/wallet/balance
// @access  Private
export const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ balance: user.walletBalance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add dummy funds to wallet
// @route   POST /api/wallet/add
// @access  Private
export const addFunds = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (Number(amount) > 500000) {
      return res.status(400).json({ message: "You cannot add more than ₹5,00,000 at a time." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.walletBalance += Number(amount);
    await user.save();

    res.json({ message: "Funds added successfully", balance: user.walletBalance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
