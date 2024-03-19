import { Db, MongoClient } from "mongodb";

const connectionString =
  process.env.MONGO_CONNECTION_STRING || "noconnectionstringpassed";

const dbName = "soulector";

let cachedClient: Db;

export async function createDbConnection() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(connectionString);
  await client.connect();
  const db = client.db(dbName);
  cachedClient = db;
  return db;
}
