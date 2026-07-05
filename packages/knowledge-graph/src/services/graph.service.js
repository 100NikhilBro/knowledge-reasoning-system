import { driver, closeDriver } from "../config/neo4j.js";
import { GraphRepository } from "../repositories/graph.repository.js";
export class GraphService {
    repository = new GraphRepository();
    async healthCheck() {
        const serverInfo = await driver.getServerInfo();
        return {
            address: serverInfo.address,
            agent: serverInfo.agent,
            protocolVersion: serverInfo.protocolVersion
        };
    }
    async initialize() {
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
    async ingest(entities, relationships) {
        await this.repository.persist(entities, relationships);
    }
    async getNode(id) {
        return this.repository.findNodeById(id);
    }
    async getNodesByType(type) {
        return this.repository.findNodesByType(type);
    }
    async getNeighbors(id) {
        return this.repository.findNeighbors(id);
    }
    async getRelationships(id) {
        return this.repository.findRelationships(id);
    }
    async findPath(from, to) {
        return this.repository.findPath(from, to);
    }
    async disconnect() {
        await closeDriver();
    }
}
