import { body, validationResult } from "express-validator";

export const validate = (validations) => async (req, res, next) => {
  for (const validation of validations) await validation.run(req);
  if (validationResult(req).isEmpty()) return next();
  // Never echo submitted values (especially passwords) in errors.
  return res.status(422).json({ message: "Invalid account details" });
};

export const loginValidator = [
  body("username").isString().bail().trim().isLength({ min: 1, max: 100 }),
  body("password").isString().bail().isLength({ min: 6, max: 72 }).bail()
    .custom(value => Buffer.byteLength(value, "utf8") <= 72),
];
export const registerValidator = [
  body("name").isString().bail().trim().isLength({ min: 1, max: 100 }),
  ...loginValidator,
];
