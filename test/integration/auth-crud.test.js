import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../app.js";
import { readConfig } from "../../utils/config.js";
import { connectToDatabase, disconnectFromDatabase } from "../../db/connections.js";
import { UserModel } from "../../models/user.js";

test("real local MongoDB: register, cookie auth, owner-scoped CRUD, reconnect, logout and login", { timeout: 180000 }, async t => {
  const mongo = await MongoMemoryServer.create({ instance: { dbName: "notes_synthetic_integration" } });
  t.after(() => mongo.stop());
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  const settings = readConfig({ ...process.env, NODE_ENV: "test", MONGODB_URL: mongo.getUri(), COOKIE_SECRET: randomBytes(32).toString("hex"), FRONTEND_ORIGINS: "http://localhost:3000", COOKIE_SAME_SITE: "lax" });
  await connectToDatabase(settings.mongoUrl);
  t.after(() => disconnectFromDatabase());
  const server = createApp(settings).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const request = (path, method = "GET", body, cookie) => fetch(`${base}/notepad${path}`, {
    method, headers: { Origin: "http://localhost:3000", "X-Notes-Request": "1", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const password = "synthetic test password";
  const register = await request("/user/register", "POST", { name: "Synthetic Owner", username: "synthetic-owner", password });
  assert.equal(register.status, 201);
  const rawCookie = register.headers.get("set-cookie");
  assert.match(rawCookie, /HttpOnly/); assert.match(rawCookie, /SameSite=Lax/); assert.doesNotMatch(rawCookie, /Domain=/);
  const cookie = rawCookie.split(";")[0];
  assert.equal((await request("/user/auth", "GET", undefined, cookie)).status, 200);
  assert.equal((await request("/user/register", "POST", { name: "Duplicate", username: "synthetic-owner", password })).status, 409);
  const user = await UserModel.findOne({ username: "synthetic-owner" });
  assert.notEqual(user.password, password);
  const created = await request("/notes/newNote", "POST", { title: "Synthetic note", content: "Persisted locally" }, cookie);
  assert.equal(created.status, 201);
  const noteID = (await created.json()).notes[0]._id;
  const second = await request("/user/register", "POST", { name: "Synthetic Other", username: "synthetic-other", password });
  assert.equal(second.status, 201);
  const otherCookie = second.headers.get("set-cookie").split(";")[0];
  assert.deepEqual((await (await request("/notes/all-notes", "GET", undefined, otherCookie)).json()).userNotes, []);
  assert.equal((await request(`/notes/deleteNote/${noteID}`, "DELETE", undefined, otherCookie)).status, 404);
  assert.equal((await request("/notes/updateNote", "PATCH", { noteID, content: "Unauthorized" }, otherCookie)).status, 404);
  const edited = await request("/notes/updateNote", "PATCH", { noteID, content: "Updated and persisted" }, cookie);
  assert.equal(edited.status, 200);
  await disconnectFromDatabase();
  assert.equal((await fetch(`${base}/health`)).status, 503);
  await connectToDatabase(settings.mongoUrl);
  const reloaded = await request("/notes/all-notes", "GET", undefined, cookie);
  assert.equal((await reloaded.json()).userNotes[0].content, "Updated and persisted");
  const logout = await request("/user/logout", "POST", {}, cookie);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request("/user/auth")).status, 401);
  const wrong = await request("/user/login", "POST", { username: "synthetic-owner", password: "incorrect" });
  assert.equal(wrong.status, 401);
  const login = await request("/user/login", "POST", { username: "synthetic-owner", password });
  assert.equal(login.status, 200);
  const loginCookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await request(`/notes/deleteNote/${noteID}`, "DELETE", undefined, loginCookie)).status, 200);
  assert.equal((await request(`/notes/deleteNote/${noteID}`, "DELETE", undefined, loginCookie)).status, 404);
  assert.deepEqual((await (await request("/notes/all-notes", "GET", undefined, loginCookie)).json()).userNotes, []);
  // Competing atomic writes must enforce the cap in MongoDB, not just in a mocked query.
  await UserModel.updateOne({ username: "synthetic-owner" }, { $set: { notes: Array.from({ length: 199 }, () => ({ title: "Synthetic cap fixture", content: "Disposable local test" })) } });
  const competing = await Promise.all(["A", "B"].map(title => request("/notes/newNote", "POST", { title, content: "Concurrent synthetic note" }, loginCookie)));
  assert.deepEqual(competing.map(response => response.status).sort(), [201, 409]);
  assert.equal((await UserModel.findOne({ username: "synthetic-owner" })).notes.length, 200);
});
