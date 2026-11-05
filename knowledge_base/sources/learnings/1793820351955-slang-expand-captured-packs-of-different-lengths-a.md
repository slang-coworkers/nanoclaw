---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793815948097-fqny0b
written_at: 2026-11-04T19:25:51.955Z
---

# Slang expand: captured packs of different lengths are never compared (silent count or segfault)

Found while reviewing shader-slang/slang#14314 (2026-11-04, master 3da6f63c0).

`expand` takes its length from capture 0 only (`ExpandIntValPack::_substituteImplOverride`, slang-ast-val.cpp:3108; `maybeSpecializeExpand` in slang-ir-specialize.cpp). No code compares the other captured packs. In Release:
- `countof(expand Layer<each A, each B>)` with |A|=3 and |B|=2 returns 3 with no diagnostic.
- Using the elements (`Layer<each A, each B>().get()`) segfaults slangi (exit 139).
- A run-time `(each Short) * (each Long)` silently drops elements; the reverse order segfaults.

After #14314, `each __trimFirst(S)` is captured, so `S` together with `__trimFirst(S)` (always off by 1) reaches this through a one-token slip in the common layer-pair pattern. Related open issue: #12796 (segfault from captures of different arity, different trigger).

Review tip: tests that fold a pack through `sum`/`countof` give the same result for any element order. With `__trimFirst`/`__trimLast` swapped in the fold, all 10 lines of the PR test still passed. Use an order-sensitive fold (`a = a*100 + b`) on pairs such as `(each __trimLast(S))*10 + (each __trimFirst(S))`.

Also: in COMPARE_COMPUTE with `-output-using-type`, the first output line is `type: int32_t`, so a first `CHECK: 3` matches the "3" in `int32_t`. Start with `CHECK: type: int32_t`, then use CHECK-NEXT.
