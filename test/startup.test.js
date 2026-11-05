import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

function run(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["index.js"], { env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    const deadline = setTimeout(() => { child.kill(); reject(new Error("Startup did not exit within 12 seconds")); }, 12000);
    child.on("error", reject);
    child.on("close", code => { clearTimeout(deadline); resolve({ code, output }); });
  });
}

test("startup never listens when configuration or MongoDB is unavailable, and logs no credentials", { timeout: 20000 }, async () => {
  const missing = await run({ JWT_SECRET: "", COOKIE_SECRET: "", MONGODB_URL: "", NODE_ENV: "test" });
  assert.equal(missing.code, 1);
  assert.doesNotMatch(missing.output, /Notes API ready/);
  const secret = randomBytes(32).toString("hex");
  const unavailable = await run({ JWT_SECRET: secret, COOKIE_SECRET: secret, MONGODB_URL: "mongodb://synthetic:synthetic@127.0.0.1:1/unavailable", NODE_ENV: "test", FRONTEND_ORIGINS: "http://localhost:3000", COOKIE_SAME_SITE: "lax" });
  assert.equal(unavailable.code, 1);
  assert.doesNotMatch(unavailable.output, /Notes API ready|synthetic|mongodb:/);
  assert.equal(unavailable.output.includes(secret), false);
});
