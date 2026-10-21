// One-off cleanup: delete PENDING questions/categories whose owner no longer exists.
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI);
const con = mongoose.connection;

for (const coll of ["questions", "categories"]) {
  const pendings = await con
    .collection(coll)
    .find({ status: "PENDING" }, { projection: { _id: 1, ownerId: 1 } })
    .toArray();
  for (const item of pendings) {
    if (!item.ownerId) continue;
    const owner = await con.collection("users").findOne({ _id: new mongoose.Types.ObjectId(String(item.ownerId)) }, { projection: { _id: 1 } });
    if (!owner) {
      await con.collection(coll).deleteOne({ _id: item._id });
      console.log(`deleted ghost ${coll} ${item._id} (owner gone)`);
    }
  }
}
console.log("done");
await mongoose.disconnect();
