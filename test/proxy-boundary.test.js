import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { proxyBoundary } from "../utils/proxy-boundary.js";
import { createAuthLimiter } from "../utils/auth-limiter.js";
import { createApp } from "../app.js";
import { readConfig } from "../utils/config.js";

test("proxy attestation isolates client budgets and rejects forged, stale and route-replayed signatures", () => {
  const secret = randomBytes(32).toString("hex");
  const time = "1792644000000";
  const guard = proxyBoundary(secret, () => Number(time));
  const limiter = createAuthLimiter({ limit: 1 });
  function request(ip, overrides = {}, method = "POST", path = "/notepad/user/login") {
    const headers = { "X-Notes-Client-IP": ip, "X-Notes-Proxy-Time": time,
      "X-Notes-Proxy-Signature": createHmac("sha256", secret).update(JSON.stringify([time, ip, "POST", "/notepad/user/login"])).digest("hex"), ...overrides };
    const req = { method, originalUrl: path, socket: { remoteAddress: "same-proxy" }, get: name => headers[name] };
    const result = { allowed: false };
    const res = { status(value) { result.status = value; return this; }, json() { return this; }, set() { return this; } };
    guard(req, res, () => limiter(req, res, () => { result.allowed = true; }));
    return result;
  }
  assert.equal(request("192.0.2.1").allowed, true);
  assert.equal(request("192.0.2.1").status, 429);
  assert.equal(request("192.0.2.2").allowed, true);
  assert.equal(request("192.0.2.3", { "X-Notes-Proxy-Signature": "0".repeat(64) }).status, 403);
  assert.equal(request("192.0.2.3", { "X-Notes-Proxy-Time": "1792643900000" }).status, 403);
  assert.equal(request("invalid").status, 403);
  assert.equal(request("192.0.2.3", {}, "GET").status, 403);
  assert.equal(request("192.0.2.3", {}, "POST", "/notepad/user/register").status, 403);
});

test("real HTTP rejects direct traffic, preserves cookie clearing and separates attested clients", async t => {
  const secret = randomBytes(32).toString("hex");
  const settings = readConfig({ JWT_SECRET: secret, COOKIE_SECRET: randomBytes(32).toString("hex"),
    NOTES_PROXY_SECRET: secret, MONGODB_URL: "mongodb://127.0.0.1/synthetic" });
  const server = createApp({ ...settings, authLimit: { limit: 1 } }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const signed = async (ip, path = "/notepad/user/login") => {
    const time = String(Date.now());
    return fetch(base + path, { method: "POST", body: "{}", headers: {
      Origin: "http://localhost:3000", "X-Notes-Request": "1", "Content-Type": "application/json",
      "X-Notes-Client-IP": ip, "X-Notes-Proxy-Time": time,
      "X-Notes-Proxy-Signature": createHmac("sha256", secret).update(JSON.stringify([time, ip, "POST", path])).digest("hex")
    } });
  };
  assert.equal((await fetch(base + "/notepad/user/auth")).status, 403);
  assert.equal((await signed("192.0.2.1")).status, 422);
  assert.equal((await signed("192.0.2.1")).status, 429);
  assert.equal((await signed("192.0.2.2")).status, 422);
  const logout = await signed("192.0.2.1", "/notepad/user/logout");
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /HttpOnly/);
});
