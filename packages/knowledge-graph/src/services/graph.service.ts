import { driver, closeDriver } from "../config/neo4j.js";


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

  async seedSampleGraph() {

    await this.repository.run(`
      CREATE
      (p:Proposal {
        id:'PEP-484',
        title:'Type Hints',
        status:'Accepted'
      }),

      (a:Author {
        name:'Guido van Rossum'
      }),

      (f:Feature {
        name:'Typing'
      }),

      (c:Concern {
        name:'Readability'
      }),

      (d:Decision {
        outcome:'Accepted'
      }),

      (v:PythonVersion {
        version:'3.5'
      })

      CREATE
      (p)-[:PROPOSED_BY]->(a),
      (p)-[:INTRODUCES]->(f),
      (p)-[:ADDRESSES]->(c),
      (p)-[:RESULTS_IN]->(d),
      (d)-[:IMPLEMENTED_IN]->(v)
    `);

    console.log("Sample graph inserted.");
  }




// async seedSampleGraph() {

//   await this.repository.run(`
//       CREATE (p:Proposal {id:'1', title:'Hello'})
//   `);

//   console.log("Sample graph inserted.");
// }

  async disconnect() {
    await closeDriver();
  }

}

