import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  revision: { type: Number, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  notes: [noteSchema],
  noteCreates: [{
    _id: false,
    key: { type: String, required: true },
    hash: { type: String, required: true },
    issuedAt: { type: Number, required: true },
  }],
});

// Metadata only: connections keep autoIndex=false. Build explicitly after an approved audit.
userSchema.index({ username: 1 }, { unique: true, name: "username_unique" });

export const UserModel = mongoose.model("user", userSchema);
