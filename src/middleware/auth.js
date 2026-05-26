const { protect } = require('./authMiddleware');

const isAuth = protect;

const roleAliases = {
  superadmin: 'SystemAdmin',
  admin: 'InstituteAdmin',
  teacher: 'Teacher',
  advisor: 'Advisor',
  student: 'Student',
  public: 'Public',
  partner: 'Partner',
  ADMIN: 'InstituteAdmin',
  SUPERADMIN: 'SystemAdmin',
};

const normalizeRole = (role) => roleAliases[role] || role;

const roleCheck = (roles = []) => {
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const allowedRoles = roles.map(normalizeRole);

    if (!req.user || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'Forbidden'
      });
    }

    next();
  };
};

module.exports = {
  isAuth,
  roleCheck
};
