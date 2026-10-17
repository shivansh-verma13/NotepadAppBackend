import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readConfig } from "../utils/config.js";
import { createApp } from "../app.js";

const env = () => ({ JWT_SECRET: randomBytes(32).toString("hex"), COOKIE_SECRET: randomBytes(32).toString("hex"), MONGODB_URL: "mongodb://127.0.0.1:27017/synthetic" });

test("configuration fails closed and production cookies are host-only HTTPS", () => {
  assert.throws(() => readConfig({}), /JWT_SECRET/);
  assert.throws(() => readConfig({ ...env(), NODE_ENV: "production" }), /FRONTEND_ORIGINS/);
  for (const origin of ["*", "https://example.test/", "https://user:password@example.test", "http://example.test"]) {
    assert.throws(() => readConfig({ ...env(), NODE_ENV: "production", FRONTEND_ORIGINS: origin }));
  }
  assert.throws(() => readConfig({ ...env(), COOKIE_SAME_SITE: "none" }));
  assert.throws(() => readConfig({ ...env(), PORT: "0" }));
  const settings = readConfig({ ...env(), NODE_ENV: "production", FRONTEND_ORIGINS: "https://notes.example.test", COOKIE_SAME_SITE: "none" });
  assert.equal(settings.cookieOptions.secure, true);
  assert.equal(settings.cookieOptions.sameSite, "none");
  assert.equal(settings.cookieOptions.domain, undefined);
});

test("HTTP boundary rejects hostile/missing origins, simple writes and invalid bodies", async t => {
  const server = createApp(readConfig(env())).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const write = (headers, body = "{}") => fetch(`${base}/notepad/user/logout`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
  for (const headers of [{}, { Origin: "http://localhost:3000" }, { Origin: "http://localhost:3000.evil.test", "X-Notes-Request": "1" }, { Origin: "null", "X-Notes-Request": "1" }]) {
    assert.equal((await write(headers)).status, 403);
  }
  const headers = { Origin: "http://localhost:3000", "X-Notes-Request": "1" };
  const logout = await write(headers);
  assert.equal(logout.status, 200);
  const cookie = logout.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.doesNotMatch(cookie, /Domain=|Secure/);
  assert.equal((await fetch(`${base}/notepad/user/logout`)).status, 405);
  assert.equal((await write(headers, "{")).status, 400);
  assert.equal((await write(headers, JSON.stringify({ x: "x".repeat(140000) }))).status, 413);
  assert.equal((await fetch(`${base}/health`)).status, 503);
  const preflight = await fetch(`${base}/notepad/user/login`, { method: "OPTIONS", headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-notes-request" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
  const invalid = await fetch(`${base}/notepad/user/login`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ username: { $ne: null }, password: "secret-value" }) });
  assert.equal(invalid.status, 422);
  assert.doesNotMatch(await invalid.text(), /secret-value/);
});
