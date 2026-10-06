export function readConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  for (const name of ["JWT_SECRET", "COOKIE_SECRET"]) {
    if (typeof env[name] !== "string" || env[name].length < 32) {
      throw new Error(`${name} must contain at least 32 characters`);
    }
  }
  if (!env.MONGODB_URL) throw new Error("MONGODB_URL is required");
  const origins = (env.FRONTEND_ORIGINS || (production ? "" : "http://localhost:3000"))
    .split(",").map(value => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error("FRONTEND_ORIGINS is required in production");
  for (const origin of origins) {
    const url = new URL(origin);
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin || url.username || url.password ||
        (production && url.protocol !== "https:")) {
      throw new Error("FRONTEND_ORIGINS must contain exact HTTP(S) origins (HTTPS in production)");
    }
  }
  const sameSite = env.COOKIE_SAME_SITE || "lax";
  if (!["lax", "strict", "none"].includes(sameSite) || (sameSite === "none" && !production)) {
    throw new Error("COOKIE_SAME_SITE must be lax/strict, or none with production HTTPS");
  }
  const port = Number(env.PORT || 4040);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
  return {
    origins, port, mongoUrl: env.MONGODB_URL, cookieSecret: env.COOKIE_SECRET,
    cookieOptions: { httpOnly: true, signed: true, path: "/", secure: production, sameSite },
  };
}
