import type { ReadinessProbe, ReadinessResult } from "../../readiness.js";
import type { ContentLoadResult } from "./load-content.js";

export function createContentReadinessProbe(result: ContentLoadResult): ReadinessProbe {
  const readiness: ReadinessResult = Object.freeze({
    ready: result.status === "loaded",
    checks: Object.freeze({
      content: result.status,
      content_version: result.status === "loaded" ? result.snapshot.contentVersion : "unknown",
    }),
  });

  return async () => readiness;
}
