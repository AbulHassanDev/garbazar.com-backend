
const User = require("../models/User");
     const Order = require("../models/Order");
     const logger = require("../utils/logger");

     const getUsers = async (req, res, next) => {
       try {
         const { page = 1, limit = 10, search = "" } = req.query;

         const query = {
           type: { $ne: "admin" },
           ...(search && {
             $or: [
               { name: { $regex: search, $options: "i" } },
               { email: { $regex: search, $options: "i" } },
             ],
           }),
         };

         const users = await User.find(query)
           .select("-password")
           .skip((page - 1) * limit)
           .limit(parseInt(limit))
           .sort({ createdAt: -1 });

         const usersWithOrderCount = await Promise.all(
           users.map(async (user) => {
             const orderCount = await Order.countDocuments({ user: user._id });
             const userType = user.type === "pro" ? "pro member" : user.type;
             return {
               ...user._doc,
               orderCount,
               userType,
               membership: user.membership,
             };
           })
         );

         const total = await User.countDocuments(query);

         res.json({ users: usersWithOrderCount, total });
       } catch (error) {
         logger.error(`Error fetching users at ${new Date().toISOString()}: ${error.message}`);
         next(error);
       }
     };

     const getUserCount = async (req, res, next) => {
       try {
         const count = await User.countDocuments({ type: { $ne: "admin" } });
         res.json({ count });
       } catch (error) {
         logger.error(`Error fetching user count at ${new Date().toISOString()}: ${error.message}`);
         next(error);
       }
     };

     console.log("Exporting from userController:", { getUsers, getUserCount });

     module.exports = {
       getUsers,
       getUserCount,
     };