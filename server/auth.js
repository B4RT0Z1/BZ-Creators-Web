import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { pool } from "./db.js";

export const sessionCookieName = "bz_admin_session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.cookieSecure,
  path: "/",
};

export const createSession = (res, user) => {
  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, issuer: "bz-creators-api", audience: "bz-creators-admin" },
  );

  res.cookie(sessionCookieName, token, {
    ...cookieOptions,
    maxAge: 12 * 60 * 60 * 1000,
  });
};

export const clearSession = (res) => {
  res.clearCookie(sessionCookieName, cookieOptions);
};

export const requireAdmin = async (req, res, next) => {
  const token = req.cookies?.[sessionCookieName];
  if (!token) return res.status(401).json({ error: "No autorizado" });

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      issuer: "bz-creators-api",
      audience: "bz-creators-admin",
    });
    const [rows] = await pool.execute(
      "SELECT id, email, role FROM users WHERE id = ? AND role = 'admin' LIMIT 1",
      [payload.sub],
    );
    if (rows.length === 0) {
      clearSession(res);
      return res.status(401).json({ error: "Sesión inválida" });
    }
    req.user = rows[0];
    return next();
  } catch {
    clearSession(res);
    return res.status(401).json({ error: "Sesión vencida o inválida" });
  }
};
