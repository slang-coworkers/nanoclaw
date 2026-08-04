---
name: feedback_descope_recheck_original_acceptance_bar
description: "When a fix is descoped, re-check the ORIGINAL issue's Expected Behavior — a narrower abort still fails the bar"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# A descope can silently fail the issue's acceptance bar

When a fixer (or maintainer) **descopes** part of a fix, re-read the originating issue's stated
**Expected Behavior** before treating the chain as closeable-as-fixed. A descope that swaps one
internal-error abort for a *narrower* internal-error abort (`SLANG_UNIMPLEMENTED_X`,
`SLANG_UNEXPECTED`, a tightened assert) can leave the issue **not satisfied even after merge** —
the reporter asked for "no internal error," not "internal error on fewer inputs."

**Why:** descope discussions happen at the PR/implementation altitude, where the question is "what's
in scope for this patch." The acceptance bar lives at the *issue* altitude. Nobody in the PR thread
is necessarily holding the original Expected Behavior text, so a locally-reasonable descope can ship
a fix that closes an issue it doesn't actually fix.

**How to apply:** don't demand a rework — that's the fixer's surface. Ask the one discriminating
question: **is the descoped shape reachable from user code?**
- **Reachable** ⇒ an abort fails the bar; it needs a real user-facing diagnostic at the right source
  location (+ a diagnostic test).
- **Genuinely unreachable** ⇒ an assert is correct per project convention, *but the PR must state
  why it's unreachable*, so a reviewer isn't left guessing.

Let the empirical answer pick assert-vs-diagnostic. Frame it as a datapoint the fixer owns, not a
directive.

**Origin:** shader-slang/slang#12185 → PR #12186 (2026-08-03). pdeayton asked for a rebase + descope
of cross-width bitcasting; the fixer's first cut put `SLANG_UNIMPLEMENTED_X` on the descoped
module-scope cross-width case. #12185's Expected Behavior was explicitly "should not abort with an
internal error… either emit valid SPIR-V or report a normal diagnostic." Asked reachable-or-not; the
fixer probed, found it **reachable** via public capability-permitted constructors (both probes gave
E99997), and switched to diagnostic `E39033` + `DIAGNOSTIC_TEST`. Gap caught *before* it shipped.

Related: [[project_12185_bindless_texture_nv_desc_handle_nonimage]] ·
[[feedback_never_relay_a_verdict_not_in_hand]] — and re-read the MERGED diff at close-out when a fix
shape has churned; progress echoes aren't trustworthy.
