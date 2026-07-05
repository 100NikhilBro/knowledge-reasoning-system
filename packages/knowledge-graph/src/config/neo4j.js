import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import neo4j from "neo4j-driver";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// project root = ../../../..
dotenv.config({
    path: path.resolve(__dirname, "../../../../.env"),
});
const uri = process.env.NEO4J_URI;
const username = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;
if (!uri || !username || !password) {
    throw new Error("Neo4j environment variables are missing.");
}
export const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
export async function closeDriver() {
    await driver.close();
}
