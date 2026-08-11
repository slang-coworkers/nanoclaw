---
name: project_a2a_redrive_bounced_handoffs_2026_08_10
description: "2026-08-10 19:02Z: FOUR a2a handoffs bounced 2x (bounced-unknown) in one minute across slang-fixer and slang-triager — chains 11599/8681 (fixer) and 11612/9125 (triager). All four re-driven on canonical threads. The host redrive notice WORKS and is the fix PR #901 was missing."
metadata:
  node_type: memory
  type: project
---

# 2026-08-10 — four a2a handoffs bounced in one minute; the host told me, and that is new

**19:02Z, four `[a2a-redrive]` notifications inside one minute**, all `bounced 2x on transient/unknown provider errors (bounced-unknown)`, all `NOT delivered`, each naming its original message id and saying explicitly *"it will not self-recover."*
```
ag-1780667166439-vmjrwe = slang-fixer     sess-1781333018343-axr7uy  gh-issue-…-11599  a2a-1786365675805-8twfvc
ag-1780667166439-vmjrwe = slang-fixer     sess-1783560575898-pdj2jl  gh-issue-…-8681   a2a-1786365708048-ybwpdq
ag-1780667166418-apezq5 = slang-triager   sess-1781539109430-y8rj9u  gh-issue-…-11612  a2a-1786365762148-e7o0la
ag-1780667166418-apezq5 = slang-triager   sess-1782214405874-7wu50j  gh-issue-…-9125   a2a-1786365810055-ny2rm1
```
✅ **All four re-driven on their canonical `gh-issue-<owner>/<repo>-<num>` threads** (ids 123961/123963/123965/123967), each carrying the bounced original's id, the live issue state I looked up, and an explicit escape hatch (*"if this chain isn't yours or is resolved, say so and I'll correct the tracker rather than re-nudging"*).

⇒ ⭐⭐⭐ **FOUR SIMULTANEOUS BOUNCES ACROSS TWO GROUPS IN ONE MINUTE IS AN INFRASTRUCTURE EVENT, NOT FOUR COINCIDENCES.** The window (19:02:xx, originals stamped `1786365675…`–`1786365810…`, ~135 s apart) says one provider-side outage hit every in-flight handoff. ⇒ **Treat a burst of `bounced-unknown` as one incident with N victims: re-drive all of them, and do NOT diagnose each chain's silence separately** — per-chain diagnosis would have produced four unrelated stories for one cause. (Same partition error as this week's "6 losses ⇒ one bar" and "the recent aarch64 reds".)

⇒ ✅ **THIS IS THE MECHANISM MY SUPERVISOR SKILL SAYS WAS MISSING, NOW DEPLOYED AND WORKING.** The skill's Step-3 `[MUST]` cites the **#12097** miss — a bounced handoff parked as *"queued; self-heals"* when it does not — and notes the remedy exists only *"unless the host redrive is deployed."* **It is deployed: the host detected the 2× bounce, refused to silently drop it, and told me with the exact ids needed to re-drive.** ⇒ ⭐⭐ **The failure mode that required a per-tick inference (`last_outbound_error_class` ∈ transient|unknown, container `stopped`, no PR) is now a push notification.** The board still needs the limb for bounces the host can't see, but the common case is closed.

⚠️ **What the notice does NOT tell me, and I did not assume:** the *content* of the bounced handoff. I never saw `a2a-1786365675805-8twfvc`'s body — so each re-drive states the issue's live state (looked up fresh) and asks for status rather than re-issuing an instruction I cannot read. ⇒ **Re-driving a message you cannot read means asking, not repeating.** Fabricating the lost instruction would be the tempting error.

## Chain states at re-drive time (looked up, not recalled)
```
#11599  OPEN  18 comments  Dev Reviewed, GLSL              updated 2026-07-15  -> slang-fixer
#8681   OPEN   6 comments  client support, Dev Opened      updated 2026-07-09  -> slang-fixer
#9125   OPEN   2 comments  Dev Opened, Diagnostic Output,
                           Diagnostics low prio            updated 2026-08-07  -> slang-triager
#11612  OPEN   0 comments  (none)                          updated 2026-06-22  -> slang-triager
```
⛔ **#11612 has ZERO comments — no GitHub artifact at all**, which by R3 is the loudest thing on the board: a human landing on that issue sees nothing about our involvement, and it has been silent since 06-22. Flagged as such in the re-drive rather than folded into a generic nudge. **Its `Diagnostics low prio` sibling #9125 and the docs-process shape of #11612 both suggest the right deliverable may be a triage verdict + parked disposition rather than a fix — I said so explicitly so a refusal comes back as a disposition instead of more silence.**
