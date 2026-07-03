import { driver } from "../config/neo4j.js";

export class GraphRepository {
  async execute(query: string, params: Record<string, unknown> = {}) {
    const session = driver.session();

    try {
      const result = await session.run(query, params);
      return result;
    } finally {
      await session.close();
    }
  }
}