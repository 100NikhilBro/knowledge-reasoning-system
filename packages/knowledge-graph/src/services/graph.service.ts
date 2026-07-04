import { driver, closeDriver } from "../config/neo4j.js";

import type {
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

interface GraphHealth{}

import { GraphRepository } from "../repositories/graph.repository.js";

export class GraphService {

  private repository = new GraphRepository();

  async healthCheck():Promise<GraphHealth> {
    const serverInfo = await driver.getServerInfo();

    return {
      address: serverInfo.address,
      agent: serverInfo.agent,
      protocolVersion: serverInfo.protocolVersion
    };
  }

  async initialize(): Promise<void> {

  await this.repository.initializeSchema();

}

  // async seedSampleGraph() {

  //   await this.repository.run(`
  //     CREATE
  //     (p:Proposal {
  //       id:'PEP-484',
  //       title:'Type Hints',
  //       status:'Accepted'
  //     }),

  //     (a:Author {
  //       name:'Guido van Rossum'
  //     }),

  //     (f:Feature {
  //       name:'Typing'
  //     }),

  //     (c:Concern {
  //       name:'Readability'
  //     }),

  //     (d:Decision {
  //       outcome:'Accepted'
  //     }),

  //     (v:PythonVersion {
  //       version:'3.5'
  //     })

  //     CREATE
  //     (p)-[:PROPOSED_BY]->(a),
  //     (p)-[:INTRODUCES]->(f),
  //     (p)-[:ADDRESSES]->(c),
  //     (p)-[:RESULTS_IN]->(d),
  //     (d)-[:IMPLEMENTED_IN]->(v)
  //   `);

  //   console.log("Sample graph inserted.");
  // }




// async seedSampleGraph() {

//   await this.repository.run(`
//       CREATE (p:Proposal {id:'1', title:'Hello'})
//   `);

//   console.log("Sample graph inserted.");
// }


async ingest(
  entities: KnowledgeEntity[],
  relationships: KnowledgeRelationship[]
): Promise<void> {

  await this.repository.persist(
    entities,
    relationships
  );

}


async getNode(id: string) {
  return this.repository.findNodeById(id);
}

async getNodesByType(type: string) {
  return this.repository.findNodesByType(type);
}

async getNeighbors(id: string) {
  return this.repository.findNeighbors(id);
}

async getRelationships(id: string) {
  return this.repository.findRelationships(id);
}

async findPath(
  from: string,
  to: string
) {
  return this.repository.findPath(from, to);
}

  async disconnect() {
    await closeDriver();
  }

}

