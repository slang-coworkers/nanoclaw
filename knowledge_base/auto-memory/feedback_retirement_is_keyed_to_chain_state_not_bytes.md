---
name: feedback_retirement_is_keyed_to_chain_state_not_bytes
description: "A size hook cannot tell you which memory rows are safe to retire — retirement is a CONTENT test (terminal chain + detail in child + no live RESUME), never a byte test. Standing answer when a coworker escalates 'which rows may I drop?'"
metadata:
  type: feedback
originSessionId: b285e0b9-76cd-4205-9319-07b838de7550
---

**A compaction hook measures SIZE; retirement is a question about CHAIN STATE. The hook cannot answer it, so "merge or drop stale entries" is an instruction the hook is not entitled to give.** When a coworker escalates *"which rows are safe to retire?"*, the answer is a predicate, not a list.

**A row may be retired only when all three hold:**
1. Its chain is **terminal** — merged/closed/refused, with no open PR, no pending maintainer gate, no `RESUME=` trigger that can still fire.
2. Its detail **already lives in the child topic file** — verified by grepping the child case-insensitively AND collapse-and-squeezed (a line-wrapped phrase returns a false zero), and confirming the hit carries the RULE not merely the WORD.
3. **Nothing else reaches the child only through this row** — i.e. removing it does not orphan the target. Walk the closure after, not before.

Fail any one ⇒ **shorten the row, never drop it.** ⭐⭐⭐**At the floor the lever is SPILLOVER, not DELETION.**

**Why (2026-08-05, slang#12320 chain).** slang-triager's memory hook fired twice demanding bulk compaction of a 51,287-byte index and explicitly asking for "merge or drop stale entries". The triager **declined and escalated to me** — correctly. It had measured first: **145 distinct authoring sessions** wrote those files and **all 64 index-row targets resolved on disk**, so the only exposure was *reachability*, and dropping rows it did not write on a size signal was outside its authority. It scoped its fix to what was its own (tightening a clause it had just added) and left everyone else's rows alone. That is the right shape: **measure the consequence, fix only your own contribution, escalate the rest.**

I measured my own store the same way before answering: **128,164 bytes, 624 files, 433 distinct authoring sessions, 92 index-row targets, 20 dark past the 24,400 bound — and 0 genuinely unreachable** (every dark target had a depth-2 path via an in-prefix child). ⭐⭐⭐**"20 rows exposed" and "0 targets lost" are both true, and only the second licenses action.** Report the CONSEQUENCE, never the proxy.

**On whether the constraint is real.** Yes, and it is established on the artifact by the *consumer*, not inferred: the injection path itself printed `WARNING: MEMORY.md is 114.4KB (limit: 24.4KB) … Only part of it was loaded.` So truncation happens.

⛔**SUPERSEDED 08-05 — the unit IS identified: CODEPOINTS / 1024, limit ≈24,986 codepoints. See [[feedback_the_memory_limit_unit_is_codepoints_over_1024]].** This paragraph previously said the figure "tracks neither bytes nor codepoints cleanly" and told readers not to re-litigate it. **That was my error, retracted:** my two "inconsistent" pairs compared different *file states* (a sibling rewrote 56→135 rows mid-session) and mismatched *units* (122.8 codepoints/1024 vs 122,777 bytes). ⭐⭐⭐**"Unexplained" was a claim about my search, not the artifact — and marking it do-not-re-open suppressed exactly the re-derivation that solved it in one command.** Never close a NEGATIVE finding.

**How to apply — standing authorization for coworkers who hit this hook:**
- **Never delete another session's row on a size signal.** No approval needed to *shorten* your own newest line, or to *add* a lifeboat link; both are always in scope.
- **The remedy for unreachability is ADDING a path, never removing a row** — and a repair grows the file, so re-walk the closure AFTER and expect to iterate.
- Report the **post-fix closure count you re-measured**, never the one you predicted.
- If a row genuinely satisfies all three retirement conditions, say which and why, and let the operator confirm — a one-line justification per row, not a bulk sweep.

Related: [[feedback_compaction_target_yields_to_load_bearing_content]] (the full ruleset), [[feedback_a_size_figure_names_a_file_check_which_one]] (measurement discipline), [[feedback_a_guard_can_be_inert_and_read_as_passing]] (a nag that reads as a gate).
