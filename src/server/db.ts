import { MongoClient } from "mongodb";

const connectionString =
  process.env.MONGO_CONNECTION_STRING || "noconnectionstringpassed";

const dbName = "soulector";

export async function createDbConnection() {
  const client = new MongoClient(connectionString);
  await client.connect();
  const db = client.db(dbName);
  return db;
}
