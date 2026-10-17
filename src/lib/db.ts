import mongoose from "mongoose";

const globalForMongoose = globalThis as unknown as {
  mongoosePromise?: Promise<typeof mongoose>;
};

/**
 * Lazily connect to MongoDB. The promise is cached on globalThis so
 * Next.js hot reloads reuse the same connection instead of leaking sockets.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (!globalForMongoose.mongoosePromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI is not set. Add it to .env — e.g. MONGODB_URI=mongodb://127.0.0.1:27017/quizrpg (see README).",
      );
    }
    globalForMongoose.mongoosePromise = mongoose.connect(uri);
  }
  return globalForMongoose.mongoosePromise;
}
