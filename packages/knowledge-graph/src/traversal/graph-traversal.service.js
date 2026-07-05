import { GraphTraversalRepository } from "./graph-traversal.repository.js";
export class GraphTraversalService {
    repository;
    constructor(repository = new GraphTraversalRepository()) {
        this.repository = repository;
    }
    async findNodeById(label, id) {
        return this.repository.findNodeById(label, id);
    }
    async findNeighbors(label, id) {
        return this.repository.findNeighbors(label, id);
    }
    async findRelationships(label, id) {
        return this.repository.findRelationships(label, id);
    }
    async findNodesByLabel(label) {
        return this.repository.findNodesByLabel(label);
    }
    async findSubgraph(label, id) {
        return this.repository.findSubgraph(label, id);
    }
    async findShortestPath(fromLabel, fromId, toLabel, toId) {
        return this.repository.findShortestPath(fromLabel, fromId, toLabel, toId);
    }
}
