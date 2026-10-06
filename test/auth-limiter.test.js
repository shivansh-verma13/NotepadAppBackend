import test from "node:test";
import assert from "node:assert/strict";
import { createAuthLimiter } from "../utils/auth-limiter.js";
import { createApp } from "../app.js";
import { readConfig } from "../utils/config.js";
import { randomBytes } from "node:crypto";

function attempt(limiter, address, headers = {}) {
  const result = { allowed: false };
  const res = {
    set(name, value) { result[name] = value; return this; },
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; return this; },
  };
  limiter({ socket: { remoteAddress: address }, headers }, res, () => { result.allowed = true; });
  return result;
}

test("shared attempt budget ignores forwarded headers and expires without extending on rejection", () => {
  let time = 1000;
  const limiter = createAuthLimiter({ limit: 2, windowMs: 2000, now: () => time });
  assert.equal(attempt(limiter, "synthetic-a").allowed, true);
  assert.equal(attempt(limiter, "synthetic-a").allowed, true);
  assert.equal(attempt(limiter, "synthetic-a", { "x-forwarded-for": "spoofed" }).status, 429);
  assert.equal(attempt(limiter, "synthetic-b").allowed, true);
  time = 2500;
  assert.equal(attempt(limiter, "synthetic-a")["Retry-After"], "1");
  time = 3000;
  assert.equal(attempt(limiter, "synthetic-a").allowed, true);
});

test("bounded store fails closed, retains active budgets and recovers expired capacity", () => {
  let time = 0;
  const limiter = createAuthLimiter({ limit: 1, maxKeys: 2, windowMs: 1000, now: () => time });
  attempt(limiter, "a"); attempt(limiter, "b");
  assert.equal(attempt(limiter, "c").status, 429);
  assert.equal(attempt(limiter, "a").status, 429);
  time = 1000;
  assert.equal(attempt(limiter, "c").allowed, true);
  assert.equal(attempt(limiter, "d").allowed, true);
  assert.equal(attempt(limiter, "e").status, 429);
  for (const value of [0, -1, Infinity, 1.5]) assert.throws(() => createAuthLimiter({ limit: value }));
});

test("HTTP login/register share limits before validation; logout and preflight stay available", async t => {
  const settings = readConfig({ JWT_SECRET: randomBytes(32).toString("hex"), COOKIE_SECRET: randomBytes(32).toString("hex"), MONGODB_URL: "mongodb://127.0.0.1:27017/synthetic" });
  const server = createApp({ ...settings, authLimit: { limit: 2 } }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/notepad/user`;
  const headers = { Origin: "http://localhost:3000", "X-Notes-Request": "1", "Content-Type": "application/json" };
  const post = (path, extra = {}) => fetch(`${base}/${path}`, { method: "POST", headers: { ...headers, ...extra }, body: "{}" });
  // Rejected origins never enter the account limiter.
  assert.equal((await post("login", { Origin: "http://evil.test" })).status, 403);
  assert.equal((await post("login")).status, 422);
  assert.equal((await post("register")).status, 422);
  const blocked = await post("LOGIN/", { "X-Forwarded-For": "192.0.2.1" });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "900");
  assert.equal(blocked.headers.get("access-control-expose-headers"), "Retry-After");
  assert.doesNotMatch(await blocked.text(), /192\.0\.2\.1/);
  assert.equal((await post("logout")).status, 200);
  assert.equal((await fetch(`${base}/login`, { method: "OPTIONS", headers: { Origin: headers.Origin, "Access-Control-Request-Method": "POST" } })).status, 204);
});
