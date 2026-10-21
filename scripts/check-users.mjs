// Verify the demo accounts have the email fields set.
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI);
const docs = await mongoose.connection
  .collection("users")
  .find({ username: { $in: ["superadmin", "admin", "hero"] } }, { projection: { username: 1, email: 1, role: 1, emailVerified: 1 } })
  .toArray();
console.log(JSON.stringify(docs, null, 1));
await mongoose.disconnect();
