import { readFileSync } from "node:fs";

import type { ContentVersion } from "../../kernel/content-id.js";
import { contentManifestSchema, type ContentRecordMetadata } from "./schema.js";

export type ContentRecordSnapshot = Readonly<
  Omit<ContentRecordMetadata, "source_urls" | "adaptation_notes"> & {
    readonly source_urls: readonly string[];
    readonly adaptation_notes: readonly string[];
  }
>;

export interface ContentSnapshot {
  readonly contentVersion: ContentVersion;
  readonly records: readonly ContentRecordSnapshot[];
}

export type ContentLoadResult =
  | Readonly<{ status: "loaded"; snapshot: ContentSnapshot }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "missing" }>;

const INVALID_RESULT: ContentLoadResult = Object.freeze({ status: "invalid" });
const MISSING_RESULT: ContentLoadResult = Object.freeze({ status: "missing" });

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function freezeRecord(record: ContentRecordMetadata): ContentRecordSnapshot {
  return Object.freeze({
    ...record,
    source_urls: Object.freeze([...record.source_urls]),
    adaptation_notes: Object.freeze([...record.adaptation_notes]),
  });
}

export function loadContent(manifestPath: string | URL): ContentLoadResult {
  let source: string;

  try {
    source = readFileSync(manifestPath, "utf8");
  } catch (error) {
    return isMissingFileError(error) ? MISSING_RESULT : INVALID_RESULT;
  }

  let input: unknown;

  try {
    input = JSON.parse(source) as unknown;
  } catch {
    return INVALID_RESULT;
  }

  const parsed = contentManifestSchema.safeParse(input);

  if (!parsed.success) {
    return INVALID_RESULT;
  }

  const snapshot: ContentSnapshot = Object.freeze({
    contentVersion: parsed.data.content_version,
    records: Object.freeze(parsed.data.records.map(freezeRecord)),
  });

  return Object.freeze({ status: "loaded", snapshot });
}
