---
name: project_slangpy_899_bool_dtype_native_tensor_scrub
description: "slangpy#899 (bool dtype for native Tensor) — jkiviluoto-nv 08-05 scrub/reassign request after mkeshavaNV departure; gap MINE-VERIFIED still live at main; dispatched to slangpy-triager."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5476ec1c-d7c6-42a4-bf46-ebf5fa63f977
---

# slangpy#899 — bool dtype for native Tensor; scrub-and-reassign request

**Inbound 2026-08-05T18:41:24Z** (`issuecomment-5195826772`), @jkiviluoto-nv: *"Mukund (mkeshavaNV)
won't be returning to this work for a while. Please scrub this issue and assess whether it is still
relevant, needs reassignment, or should be closed."*

⚠️ **Batch, not a single ask** — the same comment landed on **8 sibling issues** within 8 s
(#274, #510, #768, #779, #820, #823, #832, #899; timestamps 18:41:27–18:41:35Z, all assigned
mkeshavaNV). Each has its own Main per-issue session; per-issue routing means **each is dispatched
from its own session, never rolled into one**. ⭐ The GitHub-search probe for the comment text
returned `total: 0` — **search index lag on minutes-old comments**; the batch was found instead via
`involves:mkeshavaNV&sort=updated` + reading each issue's last comment. ⇒ *when a code-search API
returns 0 on something you just read directly, suspect the index, not the artifact.*

⛔ **My first turn on this chain DIED on `429` twice** (outbound seq 3 @18:48, seq 5 @19:08 — both
`API Error: Request rejected (429)`); no dispatch left this session until the 21:49 restart. Triager
sessions existed for 510/779/820/823/832 and fixer for 768, but **none for #899** ⇒ `ncl sessions
list | grep sqxdef | grep 899` empty until my 21:53 dispatch minted `sess-1785966830920-wzls16`.

⛔⭐⭐⭐ **RETRACTED from this memo's first draft: "nothing was dispatched for ~3 h, the chain went
dark."** FALSE. The bot scrub comment on #899 was **created 20:17:01Z** — 1 h 36 m *before* my
dispatch — by a **sibling batch session**, then `updated 22:04:02Z` (that edit is my triager's). The
chain was never dark; a **sibling** was posting onto #899 while I believed nothing had happened.
Root cause of my error: I read #899's comments at ~18:4x (2 comments), then **wrote the memo at
~21:5x reusing that 18:4x measurement** without re-reading GitHub. ⇒ ⭐⭐⭐ **A measurement inherits
the timestamp of when it was TAKEN, not of when it is CITED — on a live chain, re-read the primary
surface immediately before asserting a negative about it.** My own spine says GitHub is the primary
observability surface and the session list is secondary; I inverted that and let the session grep
speak for GitHub. ⭐⭐ *"No downstream session" and "no work happened" are different claims — the
session list is scoped to sessions I can see, not to the issue.*

⚠️ **Consequence — duplicated work, the fan-out hazard in the flesh:** because a sibling had already
posted, my dispatch forced triager to **re-derive every claim in that comment** to patch it in place.
⇒ ⭐⭐ **Before dispatching into a batch where siblings may already have fanned out, read the target
artifact for a footprint from a peer — the cost of skipping is a full re-derivation.** (Silver lining,
peer-reported: owning every claim is what surfaced the scalar-vs-vector gap below.)

⛔⭐⭐ **RETRACTED — my "the batch is inconsistent about edit-in-place vs. append" and the
"align the siblings on edit-in-place" recommendation.** Peer declined; **peer was right, 3 ways.**
(a) **#823 doesn't belong on the list** — a **human commented between** its two bot comments, so a
fresh comment is *mandated*; edit-in-place would have buried a reply to a human. My "3 inconsistent"
was **2**, and the one case I'd have "aligned" was **the compliant one**. (b) **#768 has 3 bot
comments, not 2** (third landed `22:11:56Z`, after my count). (c) **#274's scrub was edited
`22:08:04Z`, after my relay** ⇒ **my own stale-negative rule fired a SECOND time in the same turn** —
I read an 8-way live fan-out as a settled state. ⭐⭐⭐ *A batch under active fan-out has no settled
state to observe.* Full rule + verbatim evidence:
[[feedback_edit_in_place_vs_append_is_conditional_not_a_convention]].

## Relevance — MINE-VERIFIED against live `main` (not inherited)

- The issue's own stated root cause **still holds**: `slangpy/reflection/lookup.py` `_numpy_to_sgl`
  has 11 entries (int8/16/32/64, uint8/16/32/64, float16/32/64) and **no `"bool"` key**; the reverse
  `_sgl_to_numpy` is derived from it, so it lacks bool too. Read from the live contents API today.
- `ST.bool` **does exist** downstream: `reflectiontypes.py:57` `scalar_names[TR.ScalarType.bool] =
  "bool"`, `:84` `BOOL_TYPES = {TR.ScalarType.bool}`, `:99` `SCALAR_TYPE_TO_NUMPY_TYPE[bool] =
  np.int8` ⇒ the gap is genuinely **just the lookup mapping**, consistent with the report.
- Predecessor **PR #898** ("Add torch.bool support for TensorView (#884)") **merged 2026-03-31**
  (`f915a901eb1d`, head `dev/mkeshava/tensorview_bool`); issue #884 closed. So the *torch* half
  shipped and the *native Tensor* half did not — the issue is **not stale, not superseded**.
- ✅ **The hazard I flagged as code-read-only is REAL and is a live bug today** — confirmed by triager
  on the shipped 0.43.1 wheel *and* independently reproduced by me from source. `SCALAR_TYPE_TO_NUMPY_TYPE`
  maps **both** `int8→np.int8` and `bool→np.int8`; `NUMPY_TYPE_TO_SCALAR_TYPE` (`:101`) inverts by dict
  comprehension, and bool being **last** overwrites int8's key ⇒ **12 forward entries, 11 reverse**,
  `NUMPY_TYPE_TO_SCALAR_TYPE[np.dtype('int8')] == ST.bool`, and `np.dtype(bool)` is **not a key at all**.
  Live consequence with triager's controls: `int8_t <- np.int8` **REJECTED** while `uint8_t <- np.uint8`
  and `int16_t <- np.int16` pass ⇒ **not** "1-byte params unsupported". Causal check: patching *only*
  the reverse map flips int8 to OK, control stays green. Predates all bool work — `842f6a9` (#263,
  2025-05-02). **`np.int8` is currently unusable in the functional API, independent of bool.**
  ⭐ **My independent repro needed no numpy and no slangpy** — the collision is structural, requiring
  only that `np.dtype('int8') == np.dtype(np.int8)`; a 6-line dict comprehension over stand-in keys
  reproduces `12→11`, `reverse['i1']=='bool'`, no bool key, controls green. ⇒ ⭐⭐ **When a claim is
  about a data-structure collision rather than runtime behaviour, the cheapest honest check is to
  rebuild the structure from the source text — no environment, no build, no wheel.**

- ⛔ **My FRAMING of that hazard was wrong, and triager corrected it.** I said a symmetric "just add
  bool" fix would *inherit shadowing*. Actual shape: there are **two independent maps gating different
  surfaces** — `lookup.py` `_numpy_to_sgl` gates `Tensor.from_numpy`; `reflectiontypes.py:101` gates
  the functional API via `NumpyMarshall` (`builtin/numpy.py:39`). Triager **staged the fixes one at a
  time**: reflectiontypes-only ⇒ functional call ✅ / `from_numpy` ❌; both ⇒ both ✅. So **the issue
  body's one-liner fixes only half the issue**, and `Tensor.from_numpy(np.int8)` *works* today because
  it uses the other map. ⇒ ⭐⭐⭐ **A staged/one-at-a-time fix is what distinguishes "one bug with a
  shadow" from "two independent gates" — I reasoned about a single map and got the topology wrong;
  only applying each candidate fix alone reveals which surface it moves.** Also ⭐ *`_sgl_to_numpy`
  self-derives by inversion and needs no separate edit* (my memo had implied it did).

## Routing

Issue (not PR) ⇒ **`slangpy-triager`**, thread `gh-issue-shader-slang/slangpy-899` (canonical webhook
key, verbatim). Verdict + GitHub comment are **triager's** to post (closest-to-the-state); I do not
post on their behalf. Reassignment itself is a **maintainer decision** — triager recommends, does not
assign.

## Verdict — DELIVERED 2026-08-05T22:04Z

**Still relevant / needs reassignment — do NOT close.** Posted by triager (closest-to-the-state) as an
**edit in place** of the sibling's 20:17Z comment → `issuecomment-5196867001`. Verified from my seat:
`#899 bot-comments=1` (no double-post), and PR #898's file list is **only** torch marshall + tests
(`torchintegration/torchtensormarshall.py`, `bridge_fallback.py`, `slangpy_ext/utils/slangpytorchtensor.cpp`,
2 tests) — **never `lookup.py` or `reflectiontypes.py`** ⇒ triager's "not superseded" is confirmed by
file list, not by PR subject. ⭐ *Confirming a "PR X didn't fix this" claim from the PR's FILE LIST is
one API call and is decisive; the subject line "Add torch.bool support" reads exactly like the fix.*

- **Fix** = **both** maps + tests: `"bool": ST.bool` in `_numpy_to_sgl` (`lookup.py:18-30`) **and**
  de-collide `NUMPY_TYPE_TO_SCALAR_TYPE` (`reflectiontypes.py:101`). Tests: native-`Tensor` bool
  coverage (only in-tree trace is a **commented-out** case at `test_buffer_cursor.py:158`) **plus an
  `np.int8` functional-API regression test** — the test that would have caught the collision.
- **Owner recommendation** = **@ccummingsNV** (authored both commits ever touching `lookup.py`; 6 of
  last 12 in `reflection/` + `builtin/numpy.py`). **Maintainer's call — triager assigned no one, changed
  no labels/state.** Correct: reassignment is not a bot's decision.
- **#274 does NOT surface** — triager measured instead of reasoning about my flag. ⇒ ⭐⭐ **my "possibly
  the same representation question" was a hypothesis, and the right response was a measurement that
  killed it.** ⚠️ **But the first version of this verdict was UNENTITLED, and the peer caught it itself
  (`updated 22:17:15Z`): it had measured SCALAR `bool`, while #274 is about bool VECTOR layout** — its
  live filter excludes `bool1` and the upstream fix is titled *"CUDA boolean **vector** layout to use
  1-byte elements."* ⇒ ⭐⭐⭐ **A SCALAR RESULT LICENSES NO VERDICT ON A VECTOR SURFACE.** Re-measured:
  `bool`/`bool2`/`bool3`/`bool4` = **1/2/3/4 bytes**, `bool2`/`bool3` round-trip GPU-correct
  **elementwise (values, not shapes)**, consistent with pin `SGL_SLANG_VERSION = 2026.12` ⇒ conclusion
  **survives**, now entitled. #274 lives in cursor code (`test_shader_cursor.py:39` hardcodes `size=4`).
  ⚠️ **Guard stays for TWO reasons, not one: Metal untested AND wrong path** — the run exercised
  Tensor/functional, **not** the `bool1` buffer-cursor path the guard actually covers.
  ⇒ ⭐⭐ **the least-checked claim is the one that VINDICATES you** — the peer re-derived under my
  stale dispatch, owned every claim, and that is what exposed the gap in its own supporting result.
- ⚠️ **Method caveat worth preserving:** measurements ran on the **released 0.43.1 wheel**, not a build
  of `507b4cf`; transfer licensed by `git hash-object` showing all four relevant files **byte-identical**,
  and candidate fixes applied by **patching module dicts at runtime** (no repo files touched).
  ⇒ ⭐⭐ **A wheel-vs-HEAD claim is transferable exactly as far as a per-file hash equality carries it** —
  a legitimate way to skip a build, and it names its own scope (Metal/Vulkan not exercised).

**Two follow-ups are maintainer calls, deliberately NOT taken:** (1) the `np.int8` functional-API
breakage deserves **its own issue** — pre-existing since **2025-05-02** (`842f6a9` "slangpy merge" #263;
MINE-VERIFIED `gh api commits/842f6a9` → `2025-05-02T12:58:00Z`); (2) actual reassignment. Both correctly
left open rather than executed by a bot.

⛔⭐⭐ **I mis-framed (2) when relaying: I told triager reassignment was "yours" (operator's).** Peer
declined *and was right* — **bots recommend, maintainers assign**, and that line **does not move when the
task is routed one tier up**. The natural asker is **@jkiviluoto-nv** (he opened the scrub request), not
me and not the triager. ⇒ ⭐⭐ **Re-routing a decision upward does not convert it into a decision the new
tier may take** — the authority test is *who owns the repo*, not *who is senior in the chain*. I nearly
laundered a maintainer-only action into an orchestrator action by relabelling it.

⛔ **Date corruption, mine:** I relayed this origin as *"2025-05-22 era"* while **this very file said
`2025-05-02` in two places**. Peer caught it pre-filing. ⇒
[[feedback_a_correct_stored_fact_can_be_corrupted_in_the_retelling]].

⚠️ **`index-project.md` / `index-feedback.md` oversize is MINE, not triager's** — it checked (60 flat
files, 12K index, neither filename exists in its store) and correctly refused to queue on it. ⭐ *Don't
hand a peer an artifact from your own filesystem; file paths in reports refer to the writer's own mount.*

RESUME = **human (@jkiviluoto-nv or a slangpy maintainer)**: ① reassign #899 off mkeshavaNV (rec.
@ccummingsNV); ② authorize filing the `np.int8` issue — **triager will draft the body on request and
will not open it unprompted** (correct posture). Nothing further owed by either bot.

Related: [[project_slangpy_823_tensorview_interop_buffer_noncuda]] (same batch, same assignee,
already has a live triager session).
