export class DecisionPythonVersionRule {
    constructor() {
        this.name = "DecisionPythonVersionRule";
    }
    extract(entities) {
        const decision = entities.find(entity => entity.type === "Decision");
        const pythonVersion = entities.find(entity => entity.type === "PythonVersion");
        if (!decision || !pythonVersion) {
            return null;
        }
        return {
            from: decision.id,
            to: pythonVersion.id,
            type: "IMPLEMENTED_IN",
            confidence: 1.0
        };
    }
}
