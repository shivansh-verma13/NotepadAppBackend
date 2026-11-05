export const WRITE_HEADER = "X-Notes-Request";

export function requestBoundary(origins) {
  return (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !origins.includes(origin)) {
      return res.status(403).json({ message: "Request origin is not allowed" });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        (!origin || req.get(WRITE_HEADER) !== "1")) {
      return res.status(403).json({ message: "An allowed origin and request header are required" });
    }
    next();
  };
}
