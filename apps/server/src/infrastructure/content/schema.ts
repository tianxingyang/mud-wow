import { z } from "zod";

import {
  type ContentId,
  type ContentVersion,
  isContentId,
  isContentVersion,
} from "../../kernel/content-id.js";

export const canonicalStatusSchema = z.enum(["original", "adapted", "new"]);

export const contentIdSchema = z.custom<ContentId>(isContentId, {
  message: "Content ID must be a stable lower_snake_case identifier",
});

export const contentVersionSchema = z.custom<ContentVersion>(isContentVersion, {
  message: "Content version must be a non-empty opaque identifier",
});

const sourceIdSchema = z.union([
  z
    .string()
    .min(1)
    .refine((value) => value.trim() === value),
  z.number().int().nonnegative(),
  z.null(),
]);

export const contentRecordMetadataSchema = z
  .object({
    id: contentIdSchema,
    content_type: z.string().regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u),
    source_id: sourceIdSchema,
    source_version: z.literal("vanilla_1_12"),
    source_urls: z.array(z.url()),
    canonical_status: canonicalStatusSchema,
    adaptation_notes: z.array(
      z
        .string()
        .min(1)
        .refine((value) => value.trim() === value),
    ),
    content_version: contentVersionSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (record.canonical_status !== "new") {
      if (record.source_id === null) {
        context.addIssue({
          code: "custom",
          message: "Original and adapted records require a source ID",
          path: ["source_id"],
        });
      }
      if (record.source_urls.length === 0) {
        context.addIssue({
          code: "custom",
          message: "Original and adapted records require at least one source URL",
          path: ["source_urls"],
        });
      }
    }

    if (
      (record.canonical_status === "adapted" || record.canonical_status === "new") &&
      record.adaptation_notes.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Adapted and new records require adaptation notes",
        path: ["adaptation_notes"],
      });
    }

    if (record.canonical_status === "original" && record.adaptation_notes.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Original records cannot contain adaptation notes",
        path: ["adaptation_notes"],
      });
    }
  });

export const contentManifestSchema = z
  .object({
    content_version: contentVersionSchema,
    records: z.array(contentRecordMetadataSchema),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<ContentId>();

    manifest.records.forEach((record, index) => {
      if (record.content_version !== manifest.content_version) {
        context.addIssue({
          code: "custom",
          message: "Every record must use the package content version",
          path: ["records", index, "content_version"],
        });
      }

      if (ids.has(record.id)) {
        context.addIssue({
          code: "custom",
          message: "Content IDs must be unique within a package",
          path: ["records", index, "id"],
        });
      }
      ids.add(record.id);
    });
  });

export type CanonicalStatus = z.infer<typeof canonicalStatusSchema>;
export type ContentRecordMetadata = z.infer<typeof contentRecordMetadataSchema>;
export type ContentManifest = z.infer<typeof contentManifestSchema>;
