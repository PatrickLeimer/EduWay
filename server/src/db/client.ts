/**
 * MongoDB connection (official driver). One shared client per process.
 */
import { MongoClient, type Db } from 'mongodb';

let client: MongoClient | null = null;

export async function connectDb(uri: string, dbName: string): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri, { appName: 'edudriver-server' });
    await client.connect();
  }
  return client.db(dbName);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
}
