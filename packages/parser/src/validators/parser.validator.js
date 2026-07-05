export class ParserValidator {
    validate(document) {
        const required = ["pep", "title", "author"];
        for (const field of required) {
            if (!document.metadata[field]) {
                document.warnings.push({
                    code: `MISSING_${field.toUpperCase()}`,
                    message: `${field} is missing`
                });
            }
        }
    }
}
