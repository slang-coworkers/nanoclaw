---
title: "SlangPy cache-key granularity review lens: key must be a superset of what dispatch gates"
type: learning
topic: slang-compiler
source: learnings/1783879708151-slangpy-cache-key-granularity-review-lens-key-must.md
---

# SlangPy cache-key granularity review lens: key must be a superset of what dispatch gates

When reviewing a SlangPy fix that adds a field to the CallData cache-key signature (e.g. PR #1054 for #1052, which appended a per-tensor `requires_grad` bit: `[Dn,Sm]` → `[Dn,Sm,Gk]`), the decisive correctness question is **granularity vs what's actually gated at dispatch**, not "is the field present."

**The heuristic that settles it:** a cache key is correct iff it encodes a *superset* of the information that any dispatch-time decision (frozen into the cached CallData at build time) depends on. If the key is a strict superset, identical keys ⇒ identical build-time decisions ⇒ the cached flag can never be inconsistent with the args that hit that entry. Under-keying (key omits something a frozen flag depends on) is the bug class; over-keying only costs extra cache entries.

**Concrete #1052 trace (files at that time):**
- Autograd hook is gated on a *call-level* bool `NativeCallData::is_torch_autograd()` (`src/slangpy_ext/utils/slangpyfunction.cpp:107`), frozen at build from `detect_torch_tensors()` which OR-reduces `requires_grad` across all args (`slangpy/torchintegration/detection.py`; consumed `slangpy/core/calldata.py`).
- Cache key is built *per-tensor* via `get_value_signature` → `"torch\n[Dn,Sm,Gk]"` (`src/slangpy_ext/utils/slangpy.cpp:~1115`).
- The pre-fix key omitted the grad bit → a no-grad-first build froze `torch_autograd=False` under `[Dn,Sm]`; a later same-shape `requires_grad=True` call reused it → hook bypassed → `grad_fn=None`. Classic under-key.
- Per-tensor key is a strict superset of the call-level OR (all `G0` ⇒ off; any `G1` ⇒ on, derivable), so it's correct AND simpler to land (change confined to the single-tensor sig fn; a call-level bit would need aggregation inside the native fast-path builder).

**Two more checks worth doing on any signature-format change:**
1. **Both bridge paths byte-identical** — native `tensor_bridge_get_signature` (`src/slangpy_torch/torch_bridge_impl.cpp`) and Python fallback `get_signature` (`slangpy/torchintegration/bridge_fallback.py`) must produce the same bytes at the cache-key insertion point. Watch `fast_itoa`: it special-cases 0 correctly, so `G0`/`S0` emit "0" not empty — but always verify. Fallback string is snprintf'd into the same `char buffer[64]`. Tests use the `torch_bridge_mode` fixture (`slangpy/testing/plugin.py`) to run each sig test native + fallback.
2. **No other consumer parses the format** — the signature is opaque cache-key material; nothing splits/regexes it (`parse_generic_signature` in `slangpy/core/utils.py` is for Slang *type names*, unrelated). A format change also makes any stale old-format key a clean miss, never a wrong hit.

**Cache-growth tradeoff to log (non-blocking):** a per-tensor grad bit adds a ×2^N factor for N torch-tensor args, but that's dwarfed by the existing ndim×dtype combinatorics and is lazy per real use. N=1 (the common case) is exactly ×2. The only real argument for a call-level bit is capping worst-case high-arity, grad-volatile growth at ×2 — immaterial at realistic arg counts. Related: [[slangpy-torch-call-data-cache-ignores-requires-grad]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783879708151-slangpy-cache-key-granularity-review-lens-key-must.md`_
