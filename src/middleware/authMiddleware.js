const jwt = require('jsonwebtoken');
const User = require('../models/User');

const roleAliases = {
  SystemAdmin: 'superadmin',
  InstituteAdmin: 'admin',
  Teacher: 'teacher',
  Advisor: 'advisor',
  Student: 'student',
  Public: 'public',
  Partner: 'partner',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

const normalizeRole = (role) => roleAliases[role] || role;

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      req.user = await User.findById(decoded.id).select('-passwordHash');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      message: 'Not authorized, no token'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const allowedRoles = roles.map(normalizeRole);

    // Superadmin has global absolute access to all system modules
    if (userRole === 'superadmin') {
      return next();
    }

    if (!req.user || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'Forbidden: Insufficient privileges'
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
