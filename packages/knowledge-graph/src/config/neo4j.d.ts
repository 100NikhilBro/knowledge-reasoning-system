import neo4j from "neo4j-driver";
export declare const driver: neo4j.Driver;
export declare function closeDriver(): Promise<void>;
