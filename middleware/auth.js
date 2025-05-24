const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  console.log("Requested path:", req.path, "Method:", req.method);
  console.log("Environment JWT_SECRET:", process.env.JWT_SECRET);
  console.log("Authorization header:", req.headers.authorization);

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    console.log("Token:", token);

    if (!token || token === "null") {
      console.log("Invalid token: null or empty");
      return res.status(401).json({ message: "Not authorized, invalid token" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);

      req.user = await User.findById(decoded.id).select("-password");
      console.log("User found:", req.user);

      if (!req.user) {
        console.log("User not found for ID:", decoded.id);
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      next();
    } catch (error) {
      console.error("Token verification error:", error.message);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    console.log("No Authorization header or invalid format");
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

const authMiddleware = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user || !allowedTypes.includes(req.user.type)) {
      console.log(`Access denied for user: ${req.user?.email}, type: ${req.user?.type}, required: ${allowedTypes}`);
      return res.status(403).json({ message: `Access denied, ${allowedTypes.join(" or ")} type required` });
    }
    console.log(`Access granted for user: ${req.user.email}, type: ${req.user.type}`);
    next();
  };
};

module.exports = { protect, authMiddleware };