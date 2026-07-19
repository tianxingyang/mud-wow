import { describe, expect, it } from "vitest";

import { PROTOCOL_VERSION } from "../src/index";

describe("protocol package", () => {
  it("exposes the initial protocol version", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
