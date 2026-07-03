import { driver } from "../config/neo4j.js";

export class GraphRepository {

  async run(query: string, params: Record<string, unknown> = {}) {
    const session = driver.session();

    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

}

