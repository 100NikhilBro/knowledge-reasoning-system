import { driver, closeDriver } from "../config/neo4j.js";

export class GraphService {
  async healthCheck() {
    const serverInfo = await driver.getServerInfo();

    return {
      address: serverInfo.address,
      agent: serverInfo.agent,
      protocolVersion: serverInfo.protocolVersion
    };
  }

  async disconnect() {
    await closeDriver();
  }
}