import { describe, expect, it } from "vitest";

import { commandEnvelopeSchema, type CommandEnvelope, PROTOCOL_VERSION } from "../src/index";

const validEnvelope: CommandEnvelope<{ readonly direction: string }> = {
  protocolVersion: PROTOCOL_VERSION,
  commandId: "command-1",
  clientSeq: 0,
  type: "world.go",
  scopeHint: "character:example",
  payload: { direction: "north" },
};

describe("command envelope", () => {
  it("accepts a valid envelope and preserves its unknown payload", () => {
    expect(commandEnvelopeSchema.parse(validEnvelope)).toEqual(validEnvelope);
  });

  it("rejects an unsupported protocol version", () => {
    expect(
      commandEnvelopeSchema.safeParse({
        ...validEnvelope,
        protocolVersion: 2,
      }).success,
    ).toBe(false);
  });

  it("requires an explicit payload field", () => {
    expect(
      commandEnvelopeSchema.safeParse({
        protocolVersion: PROTOCOL_VERSION,
        commandId: "command-1",
        clientSeq: 0,
        type: "world.go",
      }).success,
    ).toBe(false);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid client sequence: %s",
    (clientSeq) => {
      expect(
        commandEnvelopeSchema.safeParse({
          ...validEnvelope,
          clientSeq,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ["commandId", { commandId: "" }],
    ["type", { type: "" }],
    ["scopeHint", { scopeHint: "" }],
  ])("rejects an empty %s", (_field, override) => {
    expect(
      commandEnvelopeSchema.safeParse({
        ...validEnvelope,
        ...override,
      }).success,
    ).toBe(false);
  });

  it("rejects additional top-level fields", () => {
    expect(
      commandEnvelopeSchema.safeParse({
        ...validEnvelope,
        actorId: "character:other",
      }).success,
    ).toBe(false);
  });
});
