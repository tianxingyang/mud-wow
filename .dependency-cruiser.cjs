/* global module */

/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-unresolved",
      severity: "error",
      comment: "Every source dependency must resolve to a concrete module.",
      from: {
        path: "^(?:apps|packages)/",
      },
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Coordination belongs in Application; source cycles are never allowed.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "web-no-server",
      severity: "error",
      from: {
        path: "^apps/web/src/",
      },
      to: {
        path: "^apps/server/src/",
      },
    },
    {
      name: "protocol-no-apps",
      severity: "error",
      from: {
        path: "^packages/protocol/src/",
      },
      to: {
        path: "^apps/",
      },
    },
    {
      name: "kernel-no-outer-layers",
      severity: "error",
      from: {
        path: "^apps/server/src/kernel/",
      },
      to: {
        path: "^(?:apps/server/src/(?:gateway|runtime|application|modules|infrastructure)/|apps/server/src/[^/]+[.]ts$|apps/web/src/|packages/protocol/)",
      },
    },
    {
      name: "server-root-no-concrete-layers",
      severity: "error",
      from: {
        path: "^apps/server/src/[^/]+[.]ts$",
        pathNot: "^apps/server/src/composition-root[.]ts$",
      },
      to: {
        path: "^apps/server/src/(?:gateway|runtime|application|modules)/",
      },
    },
    {
      name: "gateway-no-application-domain-or-infrastructure",
      severity: "error",
      from: {
        path: "^apps/server/src/gateway/",
      },
      to: {
        path: "^apps/server/src/(?:application|modules|infrastructure)/",
      },
    },
    {
      name: "gateway-runtime-public-only",
      severity: "error",
      from: {
        path: "^apps/server/src/gateway/",
      },
      to: {
        path: "^apps/server/src/runtime/",
        pathNot: "^apps/server/src/runtime/public[.]ts$",
      },
    },
    {
      name: "gateway-no-kernel-client-or-root-internals",
      severity: "error",
      from: {
        path: "^apps/server/src/gateway/",
      },
      to: {
        path: "^(?:apps/server/src/kernel/|apps/server/src/[^/]+[.]ts$|apps/web/src/)",
        pathNot: "^apps/server/src/readiness[.]ts$",
      },
    },
    {
      name: "runtime-no-infrastructure",
      severity: "error",
      from: {
        path: "^apps/server/src/runtime/",
      },
      to: {
        path: "^apps/server/src/infrastructure/",
      },
    },
    {
      name: "runtime-session-public-only",
      severity: "error",
      from: {
        path: "^apps/server/src/runtime/",
      },
      to: {
        path: "^apps/server/src/modules/",
        pathNot: "^apps/server/src/modules/session/public[.]ts$",
      },
    },
    {
      name: "runtime-application-public-only",
      severity: "error",
      from: {
        path: "^apps/server/src/runtime/",
      },
      to: {
        path: "^apps/server/src/application/",
        pathNot: "^apps/server/src/application/public[.]ts$",
      },
    },
    {
      name: "runtime-no-gateway-transport-or-root-internals",
      severity: "error",
      from: {
        path: "^apps/server/src/runtime/",
      },
      to: {
        path: "^(?:apps/server/src/gateway/|apps/server/src/[^/]+[.]ts$|apps/web/src/|packages/protocol/)",
      },
    },
    {
      name: "application-no-runtime",
      severity: "error",
      from: {
        path: "^apps/server/src/application/",
      },
      to: {
        path: "^apps/server/src/runtime/",
      },
    },
    {
      name: "application-domain-public-only",
      severity: "error",
      from: {
        path: "^apps/server/src/application/",
      },
      to: {
        path: "^apps/server/src/modules/",
        pathNot:
          "^apps/server/src/modules/(?:(?:session|quest|combat|world)/public|world/(?:character|rooms|presence|spawn|progression|rewards)/public)[.]ts$",
      },
    },
    {
      name: "application-no-gateway-transport-or-root-internals",
      severity: "error",
      from: {
        path: "^apps/server/src/application/",
      },
      to: {
        path: "^(?:apps/server/src/gateway/|apps/server/src/[^/]+[.]ts$|apps/web/src/|packages/protocol/)",
      },
    },
    {
      name: "domain-no-outer-layers",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/",
      },
      to: {
        path: "^apps/server/src/(?:gateway|runtime|application)/",
      },
    },
    {
      name: "domain-no-client-or-protocol",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/",
      },
      to: {
        path: "^(?:apps/web/src/|packages/protocol/)",
      },
    },
    {
      name: "domain-no-root-internals",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/",
      },
      to: {
        path: "^apps/server/src/[^/]+[.]ts$",
      },
    },
    {
      name: "session-no-cross-domain",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/session/",
      },
      to: {
        path: "^apps/server/src/modules/(?:world|quest|combat)/",
      },
    },
    {
      name: "world-no-cross-domain",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/",
      },
      to: {
        path: "^apps/server/src/modules/(?:session|quest|combat)/",
      },
    },
    {
      name: "world-root-child-public-only",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/[^/]+[.]ts$",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:character|rooms|presence|spawn|progression|rewards)/",
        pathNot:
          "^apps/server/src/modules/world/(?:character|rooms|presence|spawn|progression|rewards)/public[.]ts$",
      },
    },
    {
      name: "world-child-root-public-only",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/(?:character|rooms|presence|spawn|progression|rewards)/",
      },
      to: {
        path: "^apps/server/src/modules/world/[^/]+[.]ts$",
        pathNot: "^apps/server/src/modules/world/public[.]ts$",
      },
    },
    {
      name: "quest-no-cross-domain",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/quest/",
      },
      to: {
        path: "^apps/server/src/modules/(?:session|world|combat)/",
      },
    },
    {
      name: "combat-no-cross-domain",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/combat/",
      },
      to: {
        path: "^apps/server/src/modules/(?:session|world|quest)/",
      },
    },
    {
      name: "world-character-no-sibling-imports",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/character/",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:rooms|presence|spawn|progression|rewards)/",
      },
    },
    {
      name: "world-rooms-no-sibling-imports",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/rooms/",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:character|progression|rewards)/",
      },
    },
    {
      name: "world-presence-no-sibling-imports",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/presence/",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:character|progression|rewards)/",
      },
    },
    {
      name: "world-spawn-no-sibling-imports",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/spawn/",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:character|progression|rewards)/",
      },
    },
    {
      name: "world-progression-no-sibling-imports",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/progression/",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:character|rooms|presence|spawn|rewards)/",
      },
    },
    {
      name: "world-rewards-no-sibling-imports",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/world/rewards/",
      },
      to: {
        path: "^apps/server/src/modules/world/(?:character|rooms|presence|spawn|progression)/",
      },
    },
    {
      name: "combat-sealed-no-external",
      severity: "error",
      from: {
        pathNot: "^apps/server/src/modules/combat/",
      },
      to: {
        path: "^apps/server/src/modules/combat/(?:simulation|scheduler|tactics|lifecycle)/",
      },
    },
    {
      name: "combat-sealed-no-public-back-reference",
      severity: "error",
      from: {
        path: "^apps/server/src/modules/combat/(?:simulation|scheduler|tactics|lifecycle)/",
      },
      to: {
        path: "^apps/server/src/modules/combat/public[.]ts$",
      },
    },
    {
      name: "only-composition-root-may-import-infrastructure",
      severity: "error",
      from: {
        path: "^apps/server/src/",
        pathNot: ["^apps/server/src/composition-root[.]ts$", "^apps/server/src/infrastructure/"],
      },
      to: {
        path: "^apps/server/src/infrastructure/",
      },
    },
    {
      name: "infrastructure-no-gateway-transport-or-root-internals",
      severity: "error",
      from: {
        path: "^apps/server/src/infrastructure/",
      },
      to: {
        path: "^(?:apps/server/src/gateway/|apps/server/src/[^/]+[.]ts$|apps/web/src/|packages/protocol/)",
        pathNot: "^apps/server/src/readiness[.]ts$",
      },
    },
    {
      name: "infrastructure-runtime-ports-only",
      severity: "error",
      from: {
        path: "^apps/server/src/infrastructure/",
      },
      to: {
        path: "^apps/server/src/runtime/",
        pathNot: "^apps/server/src/runtime/ports/",
      },
    },
    {
      name: "infrastructure-application-ports-only",
      severity: "error",
      from: {
        path: "^apps/server/src/infrastructure/",
      },
      to: {
        path: "^apps/server/src/application/",
        pathNot: "^apps/server/src/application/ports/",
      },
    },
    {
      name: "infrastructure-domain-ports-only",
      severity: "error",
      from: {
        path: "^apps/server/src/infrastructure/",
      },
      to: {
        path: "^apps/server/src/modules/",
        pathNot:
          "^apps/server/src/modules/(?:(?:session|world|quest|combat)/ports/|world/(?:character|rooms|presence|spawn|progression|rewards)/ports/)",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    moduleSystems: ["es6", "cjs"],
    preserveSymlinks: false,
    tsPreCompilationDeps: "specify",
    enhancedResolveOptions: {
      conditionNames: ["types", "import", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".d.ts"],
    },
    skipAnalysisNotInRules: false,
  },
};
