export function resolveDocumentSource(document) {
    const pep = document.metadata.pep?.trim();
    if (pep) {
        return `pep-${pep}.md`;
    }
    return "document";
}
