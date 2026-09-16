import { buildGraphId } from "@knowledge/shared";
import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class PythonVersionRule {
    constructor() {
        this.name = "PythonVersionRule";
    }
    extract(document) {
        const version = document.metadata.python_version?.trim();
        if (!version) {
            return null;
        }
        if (!/\d/.test(version)) {
            return null;
        }
        return {
            id: buildGraphId("PythonVersion", version),
            type: "PythonVersion",
            label: version,
            source: resolveDocumentSource(document),
            confidence: 1.0,
            properties: {
                version
            }
        };
    }
}
