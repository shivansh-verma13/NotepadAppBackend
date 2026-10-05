import { compare, hash } from "bcrypt";
import { UserModel } from "../models/user.js";
import { COOKIE_NAME } from "../utils/constants.js";
import { createToken } from "../utils/token-manager.js";

function issueSession(req, res, user) {
  res.cookie(COOKIE_NAME, createToken(user.username, user._id.toString(), "7d"), {
    ...req.app.locals.cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const userRegister = async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (await UserModel.findOne({ username }).select("_id")) {
      return res.status(409).json({ message: "Username is unavailable" });
    }
    const user = new UserModel({ name, username, password: await hash(password, 10) });
    await user.save();
    issueSession(req, res, user);
    return res.status(201).json({ message: "Created User", userName: user.name });
  } catch {
    return res.status(500).json({ message: "Unable to register user" });
  }
};

export const userLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await UserModel.findOne({ username }).select("name username password");
    if (!user || !(await compare(password, user.password))) {
      return res.status(401).json({ message: "Incorrect password or username" });
    }
    issueSession(req, res, user);
    return res.status(200).json({ message: "User Logged In!", name: user.name });
  } catch {
    return res.status(500).json({ message: "Unable to log in" });
  }
};

export const verifyUser = async (_req, res) => {
  try {
    const user = await UserModel.findById(res.locals.jwtData.id).select("name");
    if (!user) return res.status(401).json({ message: "Authentication required" });
    return res.status(200).json({ message: "Authorized", name: user.name });
  } catch {
    return res.status(500).json({ message: "Unable to verify user" });
  }
};

// Clearing a stale/expired session is safe and idempotent; the write boundary still applies.
export const userLogout = (req, res) => {
  res.clearCookie(COOKIE_NAME, req.app.locals.cookieOptions);
  return res.status(200).json({ message: "User logged out" });
};
