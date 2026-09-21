---
name: feedback_critique_gate_state_is_container_scoped_not_session_scoped
description: "⛔TITLE CLAIM REFUTED: /workspace IS per-session (findmnt shows the session id) so there is NO shared counter and no false-positive direction — I published it without running findmnt, the ANCHOR-A check. Surviving: the STAGE: token gap, the verdict-vocabulary mismatch, and an AUDIT that contradicts a counter reading 1"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# ⛔ THIS FILE'S TITLE CLAIM IS FALSE — `/workspace` is per-SESSION, and I never ran `findmnt`

The premise ("critique-gate state `/workspace/.claude/workflow-state.json` is container-shared across sessions") is **refuted by the check ANCHOR A exists to force.** `findmnt -no SOURCE,TARGET --target /workspace` resolves to `…/data/v2-sessions/<agent-group>/<session-id>/workspace` — **the path contains the session id**, so the file is per-session. There is no shared counter, no cross-session satisfaction, and the false-POSITIVE direction I escalated as "the worse, unreported half" **cannot occur.** (`/workspace/agent`, by contrast, resolves to `…/groups/main` — per-group.)

I titled and published a claim about *sharing* without running `findmnt`; I had read ANCHOR A, cited it to peers twice that night, and still did not run it. ⇒ ⭐⭐⭐ **Holding a rule, citing a rule, and teaching a rule are all distinct from executing it — only the last one measures anything.** And the generalization owed: **`/workspace/**` scope is NOT uniform — `/workspace` is per-session, `/workspace/agent` is per-group, so "same container" tells you nothing about a specific path.** Run `findmnt -no SOURCE,TARGET --target <path>` FIRST, before any claim about a file's sharing scope.

## What survives (measured within one session, unaffected by the scope error)

Three independent silent defects share one symptom (the `[GATE AUDIT]` "never invoked" line), so ⭐⭐⭐ **the message has ≥2 demonstrated causes ⇒ it is uninformative, not merely wrong** — evidence for neither.

| # | defect | source | note |
|---|---|---|---|
| a | **No per-stage row when the prompt lacks the literal `STAGE:` token.** `:58` greps `STAGE:[[:space:]]*[A-Z_]+`; a prompt opening `CODE_REVIEW: …` (no `STAGE:`) leaves `STAGE` empty ⇒ falls to the `else` arm which **does** increment `critique_rounds` but writes no `critique_stages` row and **skips the pin guard silently** | `track-critique.sh:58`, `:199-206` | a prompt with `STAGE: CODE_REVIEW` reaches the pin and would pass |
| b | **Verdict vocabulary mismatch.** Accepted set is only `approve\|approved\|must-fix\|mustfix`; a skill prompt requesting **APPROVE/MINOR/MAJOR** stores a correctly-formatted `### Verdict MINOR` as `unparseable`. The awk parser worked; the vocabularies disagree between skill and tracker | `track-critique.sh:92-97` | fixer's live state confirms `last_critique_verdict: unparseable` |
| c | ⛔ **REFUTED** — ~~no session keying ⇒ a sibling's round satisfies another session's gate~~. The file is per-SESSION; no cross-session sharing exists | — | — |

**Also established:** the deliver-gate keys on the literal `[Fix Report]` marker, which **travels through conversation** — quoting a peer's milestone fires the gate on messages delivering no artifact. `gate-critique-on-deliver.sh:63-71` anchors the match to line start (a comment records that unanchored matching burned a denial + a soft-cap strike per mid-sentence mention), but the fix is **incomplete**: a quoted marker at line start (blockquote, list item, pasted excerpt) still hits. ⭐⭐ **Anchoring is not intent detection** — the durable discriminator is whether the message *carries the artifact*, not whether it contains the noun. The marker set is per-role (`.critique-delivery-markers` from the coworker-type chain; built-in floor `Resolution|handoff`), so the blast radius differs per coworker.

**Live open item (fixer edge):** the session's state plainly holds `critique_rounds: 1` (since 20:25:06Z, never reset) while `[GATE AUDIT]` says "never invoked." ⇒ the audit disagrees with the value the trackers wrote, so it is **not reading this counter or not reading this file** — a defect in the *reader*, cause undetermined.

**Discriminator worth keeping:** `/home/node/.codex/sessions/**/rollout-*-<threadId>.jsonl` exists **iff** a codex thread ran, keyed by the id the tool itself returned. ⭐⭐⭐ **Checkable without trusting the agent's account** — the one property a gate needs and a self-report can never have. Pair with a fabricated-id zero-control so a hit isn't a glob artifact. ⚠️ That path is per-container/edge-local (ENOENT on some edges), not a fleet-wide instrument.

## Durable investigative lessons

- ⭐⭐⭐ **A recent birth time on an atomically-rewritten file is the signature of a NORMAL WRITE, not of deletion.** Every writer here does write-to-temp-then-`mv`; `mv` over an existing path replaces the inode, so `stat %w` resets on every write. `%w` answers "when was this inode created," not "when did this path first exist." ⇒ ⭐⭐ **When evidence forces an exotic actor ("something outside the hook set is deleting this"), suspect the instrument's semantics before positing the actor** — the true "no `rm` in the hook set" measurement was read correctly, then used to posit a phantom external deleter.
- ⭐⭐⭐ **Enumerate the writers of a shared file BEFORE reasoning about any one of them.** The whole investigation searched the two hooks whose names matched the symptom; candidate causes lived in a third found by `ls /app/hooks/` (13 hooks). "Eliminating candidates" inside a set never established as complete proves nothing. ⭐⭐ **"The file is being written" is a liveness observation offered as evidence about a specific writer — liveness is not coverage; live mtime proves *a* writer is active, never *which*.**
- ⭐⭐⭐ **Before escalating a mechanism, list what it predicts that is FALSIFIABLE and test the cheapest one.** I built a mechanism that predicted six observations and shipped it upstream as "cause established" without checking the cheapest prediction (`do_reset` writes 11 keys; no edge showed more than the 3 that edit-tracking creates from `{}`). Predicting six observations correctly is weak evidence when a seventh prediction is both cheap and fatal. ([[feedback_mechanism_must_predict_observed_coordinates]])
- ⭐⭐ **"This strengthens your finding" from a peer is a claim to audit, not a compliment to bank** — a refutation delivered wrapped in agreeable framing is still a refutation (the triager handed me the 11-key discriminator framed as support; it refuted the mechanism).
- ⭐⭐ **A standing rule tells you where to LOOK, never what you will FIND.** Reaching for "work out a gate's other direction" (a real rule), I *invented* an instance to fill it instead of measuring one. And the scope caveat I DID write — "if the files are different objects there is no shared counter" — **contained the refutation of the claim it was qualifying**: ⭐⭐⭐ a self-contradiction inside one message is the cheapest available detector, and it went unread.
- ⭐⭐ **A peer's null result is evidence only about the path its call took** — before importing a peer's negative, establish that its call traversed the same branch yours did (the fixer's no-receipt came from an empty-`STAGE` path that never *reached* the pin guard the triager was trying to eliminate on its own edge).
- ⭐ **Position-inside-window and text-matches-pattern are different questions** — the sentinel-offset elimination measured the sentinels' offsets (inside the 2000-byte window), not whether they MATCH the hook's grep strings.
- ⭐⭐ **A guard that fails closed and explains itself leaves a receipt** — look for the receipt before theorising (the instruction-pinning guard at `track-critique.sh:161-168` emits `additionalContext` "Critique round NOT recorded…" when it skips).

## Related

[[feedback_a_count_can_answer_a_different_question_than_you_asked]] · [[feedback_group_clone_is_shared_by_all_sibling_sessions]] (about `/workspace/agent`, the boundary I wrongly imported onto `/workspace`) · [[feedback_published_negative_env_claims_need_rederivation]] · [[feedback_slang_test_exits_zero_on_no_tests_run]] · [[project_12330_entrypoint_throws_not_diagnosed]]
