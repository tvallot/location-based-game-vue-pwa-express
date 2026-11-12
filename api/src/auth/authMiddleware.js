export function createAuthMiddleware(validateToken) {
  return async function authenticate(req, res, next) {
    const header = req.headers.authorization ?? "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }

    const user = await validateToken(header.slice("Bearer ".length));
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    return next();
  };
}

export function requireRole(role) {
  return function checkRole(req, res, next) {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Reserved to ${role}s` });
    }
    return next();
  };
}
