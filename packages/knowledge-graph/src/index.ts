import { GraphService } from "./services/graph.service.js";

async function bootstrap() {
  const graph = new GraphService();

  console.log("Connecting to Neo4j...\n");

  const health = await graph.healthCheck();

  console.log("Connected Successfully");
  console.log(health);

  await graph.disconnect();

  console.log("\nDriver Closed");
}

bootstrap().catch(console.error);