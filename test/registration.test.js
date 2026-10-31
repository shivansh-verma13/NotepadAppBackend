import test from "node:test";
import assert from "node:assert/strict";
import { UserModel } from "../models/user.js";
import { userRegister } from "../controllers/user-controllers.js";

test("registration only maps the username constraint to a redacted conflict", async t => {
  const original = UserModel.findOne;
  t.after(() => { UserModel.findOne = original; });
  for (const [error, expected] of [
    [{ code: 11000, keyPattern: { username: 1 }, keyValue: { username: "private-value" } }, 409],
    [{ code: 11000, keyPattern: { _id: 1 } }, 500],
    [{ code: 11000, keyPattern: { username: 1, other: 1 } }, 500],
    [{ code: 11000 }, 500],
    [new Error("private database detail"), 500],
  ]) {
    UserModel.findOne = () => ({ select: async () => { throw error; } });
    let status, body;
    const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
    await userRegister({ body: { name: "Synthetic", username: "synthetic", password: "synthetic-password" } }, res);
    assert.equal(status, expected);
    assert.deepEqual(body, { message: expected === 409 ? "Username is unavailable" : "Unable to register user" });
  }
});
