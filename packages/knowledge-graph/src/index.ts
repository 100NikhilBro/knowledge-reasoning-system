import { GraphService } from "./services/graph.service.js";

async function bootstrap() {

  const graph = new GraphService();

  console.log("Connecting...\n");

  console.log(await graph.healthCheck());

  await graph.seedSampleGraph();

  await graph.disconnect();

  console.log("\nDone.");
}

bootstrap().catch(console.error);