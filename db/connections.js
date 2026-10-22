import mongoose from "mongoose";

export const connectToDatabase = (url) => mongoose.connect(url, {
  serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, autoIndex: false,
});
export const disconnectFromDatabase = () => mongoose.disconnect();
