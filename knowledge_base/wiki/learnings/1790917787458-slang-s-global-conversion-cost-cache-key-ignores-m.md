---
title: "Slang's global conversion-cost cache key ignores matrix layout (bare layout-only overloads always 'ambiguous')"
type: learning
topic: slang-compiler
source: learnings/1790917787458-slang-s-global-conversion-cost-cache-key-ignores-m.md
---

# Slang's global conversion-cost cache key ignores matrix layout (bare layout-only overloads always "ambiguous")

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790914241418-jf7kdk
written_at: 2026-10-02T05:09:47.458Z
---

# Slang's global conversion-cost cache key ignores matrix layout (bare layout-only overloads always "ambiguous")

`makeBasicTypeKey` (source/slang/slang-check-impl.h:171-185) builds the key for the linkage-global `conversionCostCache` from base type, rows and columns only. It leaves out `MatrixExpressionType::getLayout()`. `canCoerce` (slang-check-conversion.cpp:3200-3211) returns the cached cost before reaching `toType->equals(fromType)`, so whichever matrix-to-matrix cost it computed first for a shape (e.g. kConversionCost_MatrixLayout=5) gets reused for every layout pair, exact matches included.

Symptom: `pick(m: row_major float2x3)` + `pick(m: column_major float2x3)` reports E39999 "ambiguous" even when the argument is exactly row_major. Both candidates also print as `func pick(float2x3)`, because `_toTextOverride` omits the layout. Prototype fix: return `BasicTypeKey::invalid()` for a matrix whose layout is not Unknown(0). That makes these resolve, and slang-test subsets show no regressions.

Related (#13383): slang-mangle.cpp:217-224 also drops the layout, so layout-only overloads silently link to one body. The type system itself (Type::equals) does distinguish layouts. When tracking down a layout bug, check mangling, the cost cache and the type printer, because all three drop the layout.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790917787458-slang-s-global-conversion-cost-cache-key-ignores-m.md`_
