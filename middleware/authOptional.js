// middleware/authOptional.js
import jwt from "jsonwebtoken";

export default function authOptional(req, _res, next) {
  const hdr = req.header("Authorization");
  if (!hdr) return next();
  try {
    const token = hdr.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
  } catch {
    // ignore invalid/expired tokens
  }
  next();
}
