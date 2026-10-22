import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

// Only the configured Netlify function can attest a client address. Express
// trust proxy remains false; forwarded headers never select an auth budget.
export function proxyBoundary(secret, now = Date.now) {
  return (req, res, next) => {
    if (!secret) return next(); // local/test mode only; production requires it
    const ip = req.get("X-Notes-Client-IP");
    const time = req.get("X-Notes-Proxy-Time");
    const signature = req.get("X-Notes-Proxy-Signature");
    const reject = () => res.status(403).json({ message: "Unverified API proxy" });
    if (!isIP(ip || "") || !/^\d{13}$/.test(time || "") ||
        Math.abs(now() - Number(time)) > 30000 || !/^[a-f0-9]{64}$/.test(signature || "")) return reject();
    const payload = JSON.stringify([time, ip, req.method, req.originalUrl]);
    const expected = createHmac("sha256", secret).update(payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return reject();
    req.notesClientIP = ip;
    return next();
  };
}
