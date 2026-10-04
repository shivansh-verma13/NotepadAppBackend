import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "./constants.js";
export const createToken = (username,id,expiresIn) => jwt.sign({username,id},process.env.JWT_SECRET,{expiresIn,algorithm:"HS256"});
export const verifyToken = (req,res,next) => {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (typeof token !== "string" || !token.trim()) return res.status(401).json({message:"Authentication required"});
  try {
    const data = jwt.verify(token,process.env.JWT_SECRET,{algorithms:["HS256"]});
    if (typeof data !== "object" || typeof data.id !== "string" || !/^[a-f\d]{24}$/i.test(data.id)) return res.status(401).json({message:"Authentication required"});
    res.locals.jwtData = data;
  } catch { return res.status(401).json({message:"Authentication required"}); }
  return next();
};
