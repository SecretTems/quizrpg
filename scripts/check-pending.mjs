// Inspect all PENDING questions and categories to find ghost submissions.
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI);
const q = await mongoose.connection
  .collection("questions")
  .find({ status: "PENDING" }, { projection: { _id: 1, subject: 1, text: 1, ownerId: 1, createdAt: 1 } })
  .toArray();
const userIds = [...new Set(q.map((x) => x.ownerId).filter(Boolean))];
const owners = await mongoose.connection
  .collection("users")
  .find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(String(id))) } }, { projection: { username: 1 } })
  .toArray();
const ownerMap = new Map(owners.map((o) => [String(o._id), o.username]));
for (const item of q) {
  const owner = item.ownerId ? ownerMap.get(String(item.ownerId)) : null;
  console.log(`${owner ? "OK" : "GHOST"} ${item._id} "${String(item.text).slice(0, 60)}" owner=${item.ownerId} (${owner ?? "deleted user"})`);
}
const c = await mongoose.connection
  .collection("categories")
  .find({ status: "PENDING" }, { projection: { _id: 1, name: 1, ownerId: 1 } })
  .toArray();
for (const item of c) {
  const owner = item.ownerId ? ownerMap.get(String(item.ownerId)) : null;
  console.log(`${owner ? "OK" : "GHOST"} category ${item._id} "${item.name}" owner=${item.ownerId} (${owner ?? "deleted user"})`);
}
await mongoose.disconnect();
