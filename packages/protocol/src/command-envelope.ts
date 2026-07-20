import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

export const commandEnvelopeSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    commandId: z.string().min(1),
    clientSeq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    type: z.string().min(1),
    scopeHint: z.string().min(1).optional(),
    payload: z.unknown(),
  })
  .strict();

type ParsedCommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

export type CommandEnvelope<TPayload = unknown> = Omit<ParsedCommandEnvelope, "payload"> & {
  payload: TPayload;
};
