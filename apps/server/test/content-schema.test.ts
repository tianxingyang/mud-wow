import { describe, expect, it } from "vitest";

import { contentManifestSchema } from "../src/infrastructure/content/schema";

const CONTENT_VERSION = "northshire-v1:design-freeze";

function createRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "room_northshire_abbey",
    content_type: "room",
    source_id: 12,
    source_version: "vanilla_1_12",
    source_urls: ["https://example.com/rooms/12"],
    canonical_status: "adapted",
    adaptation_notes: ["Merged the original space into one text room."],
    content_version: CONTENT_VERSION,
    ...overrides,
  };
}

describe("content manifest schema", () => {
  it("accepts the empty M0 package and treats content_version as an opaque value", () => {
    const result = contentManifestSchema.safeParse({
      content_version: CONTENT_VERSION,
      records: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid common metadata for original, adapted, and new records", () => {
    const result = contentManifestSchema.safeParse({
      content_version: CONTENT_VERSION,
      records: [
        createRecord({
          id: "npc_deputy_willem",
          content_type: "npc",
          canonical_status: "original",
          adaptation_notes: [],
        }),
        createRecord(),
        createRecord({
          id: "room_slice_boundary",
          source_id: null,
          source_urls: [],
          canonical_status: "new",
          adaptation_notes: ["Marks the current slice boundary."],
        }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unstable and duplicate content IDs", () => {
    expect(
      contentManifestSchema.safeParse({
        content_version: CONTENT_VERSION,
        records: [createRecord({ id: "Room-1" })],
      }).success,
    ).toBe(false);

    expect(
      contentManifestSchema.safeParse({
        content_version: CONTENT_VERSION,
        records: [createRecord(), createRecord()],
      }).success,
    ).toBe(false);
  });

  it("rejects records whose content version differs from the package version", () => {
    const result = contentManifestSchema.safeParse({
      content_version: CONTENT_VERSION,
      records: [createRecord({ content_version: "another-package" })],
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["unsupported source version", { source_version: "classic_latest" }],
    ["unsupported canonical status", { canonical_status: "canonical" }],
    ["adapted record without notes", { adaptation_notes: [] }],
    ["original record with adaptation notes", { canonical_status: "original" }],
    ["adapted record without a source", { source_id: null, source_urls: [] }],
  ])("rejects %s", (_description, overrides) => {
    const result = contentManifestSchema.safeParse({
      content_version: CONTENT_VERSION,
      records: [createRecord(overrides)],
    });

    expect(result.success).toBe(false);
  });
});
