import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SUPPORTED_EXTENSIONS
} from "../types/discovered-document.js";

export interface KnowledgePathsConfig {

  /**
   * Absolute path to knowledge_state/raw (or configured raw root).
   */
  rawDir: string;

  /**
   * Absolute path to knowledge_state/processed.
   */
  processedDir: string;

  /**
   * File extensions accepted by discovery (lowercase, including dot).
   */
  supportedExtensions: string[];

}

/**
 * Monorepo root (knowledge_state + .env live here), regardless of pnpm
 * package cwd under apps/worker.
 */
export function resolveMonorepoRoot(
  fromModuleUrl: string = import.meta.url
): string {

  return path.resolve(
    path.dirname(fileURLToPath(fromModuleUrl)),
    "../../../.."
  );

}

function resolveFromBase(
  value: string,
  baseDir: string
): string {

  return path.isAbsolute(value)
    ? path.normalize(value)
    : path.resolve(baseDir, value);

}

function parseExtensions(
  value: string | undefined
): string[] {

  if (!value?.trim()) {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  return value
    .split(",")
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)
    .map(part =>
      part.startsWith(".")
        ? part
        : `.${part}`
    );

}

/**
 * Resolve knowledge_state path configuration from environment.
 *
 * KNOWLEDGE_RAW_DIR=knowledge_state/raw
 * KNOWLEDGE_PROCESSED_DIR=knowledge_state/processed
 * INGESTION_SUPPORTED_EXTENSIONS=.md
 *
 * Relative paths resolve against the monorepo root by default (not apps/worker
 * cwd). Absolute paths are accepted. Tests may pass an explicit baseDir.
 */
export function resolveKnowledgePathsConfig(
  env: NodeJS.ProcessEnv = process.env,
  baseDir: string = resolveMonorepoRoot()
): KnowledgePathsConfig {

  const rawDir =
    env.KNOWLEDGE_RAW_DIR?.trim()
    || path.join("knowledge_state", "raw");

  const processedDir =
    env.KNOWLEDGE_PROCESSED_DIR?.trim()
    || path.join("knowledge_state", "processed");

  return {
    rawDir: resolveFromBase(rawDir, baseDir),
    processedDir: resolveFromBase(processedDir, baseDir),
    supportedExtensions: parseExtensions(
      env.INGESTION_SUPPORTED_EXTENSIONS
    )
  };

}

/** @deprecated Prefer resolveFromBase via resolveKnowledgePathsConfig. */
export function resolveFromCwd(
  value: string,
  cwd: string = process.cwd()
): string {

  return resolveFromBase(value, cwd);

}
