import {
  mkdtemp,
  mkdir,
  writeFile,
  rm
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RawDocumentDiscovery }
from "../src/discovery/raw-document-discovery.js";

describe("RawDocumentDiscovery", () => {

  const tempDirs: string[] = [];

  afterEach(async () => {

    await Promise.all(
      tempDirs.splice(0).map(async dir => {
        await rm(dir, {
          recursive: true,
          force: true
        });
      })
    );

  });

  async function createLayout() {

    const root =
      await mkdtemp(
        path.join(os.tmpdir(), "knowledge-discovery-")
      );

    tempDirs.push(root);

    const rawDir =
      path.join(root, "raw");

    const processedDir =
      path.join(root, "processed");

    await mkdir(
      path.join(rawDir, "python-peps"),
      { recursive: true }
    );

    await mkdir(
      path.join(rawDir, "notes"),
      { recursive: true }
    );

    await mkdir(processedDir, {
      recursive: true
    });

    await writeFile(
      path.join(rawDir, "python-peps", "pep-484.md"),
      "PEP: 484\n"
    );

    await writeFile(
      path.join(rawDir, "python-peps", "pep-8.md"),
      "PEP: 8\n"
    );

    await writeFile(
      path.join(rawDir, "notes", "readme.txt"),
      "ignore me"
    );

    await writeFile(
      path.join(rawDir, "notes", "draft.md"),
      "# draft\n"
    );

    return {
      rawDir,
      processedDir
    };

  }

  it("discovers multiple supported documents", async () => {

    const { rawDir, processedDir } =
      await createLayout();

    const discovery =
      new RawDocumentDiscovery({
        rawDir,
        processedDir,
        supportedExtensions: [".md"]
      });

    const docs =
      await discovery.discover();

    expect(
      docs.map(doc => doc.relativePath)
    ).toEqual([
      "notes/draft.md",
      "python-peps/pep-484.md",
      "python-peps/pep-8.md"
    ]);

  });

  it("ignores unsupported files", async () => {

    const { rawDir, processedDir } =
      await createLayout();

    const discovery =
      new RawDocumentDiscovery({
        rawDir,
        processedDir,
        supportedExtensions: [".md"]
      });

    const docs =
      await discovery.discover();

    expect(
      docs.some(doc =>
        doc.relativePath.endsWith(".txt")
      )
    ).toBe(false);

  });

  it("skips documents already present under processed", async () => {

    const { rawDir, processedDir } =
      await createLayout();

    await mkdir(
      path.join(processedDir, "python-peps"),
      { recursive: true }
    );

    await writeFile(
      path.join(processedDir, "python-peps", "pep-484.md"),
      "already done"
    );

    const discovery =
      new RawDocumentDiscovery({
        rawDir,
        processedDir,
        supportedExtensions: [".md"]
      });

    const docs =
      await discovery.discover();

    expect(
      docs.map(doc => doc.relativePath)
    ).toEqual([
      "notes/draft.md",
      "python-peps/pep-8.md"
    ]);

  });

  it("handles missing raw directories safely", async () => {

    const root =
      await mkdtemp(
        path.join(os.tmpdir(), "knowledge-missing-")
      );

    tempDirs.push(root);

    const discovery =
      new RawDocumentDiscovery({
        rawDir: path.join(root, "does-not-exist"),
        processedDir: path.join(root, "processed"),
        supportedExtensions: [".md"]
      });

    await expect(discovery.discover())
      .resolves.toEqual([]);

  });

  it("handles empty raw directories safely", async () => {

    const root =
      await mkdtemp(
        path.join(os.tmpdir(), "knowledge-empty-")
      );

    tempDirs.push(root);

    const rawDir =
      path.join(root, "raw");

    await mkdir(rawDir, { recursive: true });

    const discovery =
      new RawDocumentDiscovery({
        rawDir,
        processedDir: path.join(root, "processed"),
        supportedExtensions: [".md"]
      });

    await expect(discovery.discover())
      .resolves.toEqual([]);

  });

});
