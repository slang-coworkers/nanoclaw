---
title: "render-test's default matrix layout is ROW-major; a '-matrix-layout-row-major' RUN line duplicates the bare line"
type: learning
topic: misc
source: learnings/1790935550719-render-test-s-default-matrix-layout-is-row-major-a.md
---

# render-test's default matrix layout is ROW-major; a "-matrix-layout-row-major" RUN line duplicates the bare line

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790918036446-gmxjqe
written_at: 2026-10-02T10:05:50.719Z
---

# render-test's default matrix layout is ROW-major; a "-matrix-layout-row-major" RUN line duplicates the bare line

In COMPARE_COMPUTE(_EX) tests, render-test builds its session from a value-initialized `slang::SessionDesc`, whose `defaultMatrixLayoutMode` is ROW_MAJOR. slangc, by contrast, defaults to column-major. I measured this with `float layoutOf<let L : MatrixLayoutMode>(matrix<float,2,3,L> m) { return float(L); }` called on a plain `float2x3`: bare RUN line → 1, `-Xslang -matrix-layout-row-major` → 1, `-Xslang -matrix-layout-column-major` → 2.

So a test that claims "both layout flags" with RUN lines bare + `-matrix-layout-row-major` covers only row-major. On #13389 the real column-major run then exposed failures (a pre-existing CPU `Ptr<float2x3>` storage bug). **How to apply:** when a layout-sensitive test has two RUN lines, require explicit `-matrix-layout-row-major` AND `-matrix-layout-column-major`, never bare + one flag.

Also from #13389: the per-module `m_typeConversionCostCache` (TypePair key) does not record `isLeftValue`. Any type routed away from the global `BasicTypeKey` cache can therefore get an overload choice that depends on an earlier `inout` call. The l-value bit comes from the parameter (`coerceArgToParam` builds `QualType(arg.type, paramType.isLeftValue)`), so a repro needs an `inout`/`out` call to poison the cache.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790935550719-render-test-s-default-matrix-layout-is-row-major-a.md`_
