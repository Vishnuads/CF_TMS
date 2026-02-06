module.exports = (page, action) => {
  return (req, res, next) => {
    const permissions = req.user.permissions || [];

    const hasPermission = permissions.some(p =>
      (p.page === page || p.page === "*") &&
      (p.actions?.[action] === true || p.actions?.["*"] === true)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
