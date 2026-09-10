---
name: feedback_stage_fixes_one_at_a_time_to_find_the_topology
description: "I called a dtype gap 'one map with a shadowing hazard'; staging candidate fixes one at a time proved TWO independent maps gating different surfaces, so the issue's one-liner fixes only half."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5476ec1c-d7c6-42a4-bf46-ebf5fa63f977
---

# Stage candidate fixes one at a time — it is what reveals the topology

**Measured 2026-08-05, slangpy#899 (bool dtype for native `Tensor`).** From a source read I flagged:
`SCALAR_TYPE_TO_NUMPY_TYPE` maps both `int8→np.int8` and `bool→np.int8`, the reverse map inverts it, so
`np.dtype('int8')` resolves to `ST.bool`. I framed the consequence as **"a symmetric 'just add bool' fix
inherits a shadowing hazard"** — one map, one bug, one shadow.

**Wrong topology.** slangpy-triager applied the candidate fixes **one at a time** against a live device:

| stage | `Tensor.from_numpy(np.bool_)` | functional call w/ `np.bool_` |
|---|---|---|
| shipped | ❌ | ❌ |
| + `reflectiontypes.py` only | ❌ still fails | ✅ |
| + `lookup.py` too | ✅ | ✅ |

There are **two independent maps gating different user surfaces**: `lookup.py` `_numpy_to_sgl` gates
`Tensor.from_numpy`; `reflectiontypes.py:101` gates the functional API via `NumpyMarshall`
(`builtin/numpy.py:39`). So **the issue body's proposed one-liner fixes only half the issue** — and
`Tensor.from_numpy(np.int8)` *works today* precisely because it uses the other map.

## The rules

⭐⭐⭐ **Applying each candidate fix ALONE is what distinguishes "one bug with a shadow" from "two
independent gates."** Reasoning over a single map cannot produce that distinction; the staged table can.
Both stories predict "bool fails today" — only the staging predicts *which surface each edit moves*.

⭐⭐ **A stated root cause in an issue body is a hypothesis about topology, not just about a line.** It
can be *correct and incomplete* at the same time — this one named a real missing entry in a real map and
still left half the bug standing.

⭐ **A derived map needs no separate edit; an independent map does.** `_sgl_to_numpy` self-derives by
inversion (verified: inverting `{int8,bool}` yields both reverse keys), so it is not a third site. Check
whether a "second map" is *derived* or *independent* before counting fix sites.

⭐⭐ **When the claim is a data-structure collision rather than runtime behaviour, rebuild the structure
from the source text** — no environment, no build, no wheel. I reproduced `12 forward → 11 reverse`,
`reverse[dtype('int8')]=='bool'`, no bool key, with `uint8`/`int16` controls green, in six lines and
**without numpy installed**; it needs only that `np.dtype('int8') == np.dtype(np.int8)`.

⭐⭐ **Controls are what convert "int8 is rejected" into "the collision causes it":** `uint8_t←np.uint8`
and `int16_t←np.int16` pass, so it is not "1-byte params unsupported"; patching *only* the reverse map
flips int8 to OK with the control still green. Bug predates all bool work (`842f6a9`, #263, 2025-05-02)
⇒ **`np.int8` is unusable in the functional API today, independent of bool.**

Related: [[project_slangpy_899_bool_dtype_native_tensor_scrub]],
[[feedback_a_measurement_cited_later_is_a_stale_negative]].
