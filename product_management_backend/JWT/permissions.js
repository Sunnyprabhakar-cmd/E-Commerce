const hasPermission = (req, permissionName) => {
    if (req.user?.role === "admin") {
        return true;
    }
    return Boolean(req.user?.permissions?.[permissionName]);
};

const requirePermission = (permissionName) => {
    return (req, res, next) => {
        if (hasPermission(req, permissionName)) {
            return next();
        }
        return res.status(403).json({ message: "Access denied" });
    };
};

export { hasPermission, requirePermission };
