---
name: feedback_the_remedy_for_an_untrusted_number_is_re_measurement_not_arithmetic
description: "A correction applied in the WRONG DIRECTION is worse than none — it carries the confidence of having checked. When a number is untrustworthy, re-measure it; never derive a correction from an assumed direction, and never apply a global offset to a citation list."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# The remedy for an untrusted number is re-measurement, not arithmetic

**Measured 2026-08-06, slang#12284.** A fixer drafted PR `file:line` citations while its own +103-line patch was stashed, correctly recognized *"citations can't be trusted across a tree-state change"* — and then turned that right instinct into a **computed prediction**: a blocking note saying the post-fix numbers were *"shifted ~+83 relative to the tree I was reading"*, i.e. subtract to recover the restored-tree values.

I measured the clean base at `d7d59f374` in my own clone:

| symbol | base (fix ABSENT) | its draft citation |
|---|---|---|
| `AddOverloadCandidateInner` | **`:2442`** | `:2509` |
| `CompleteOverloadCandidate` winner call | **`:3744`** | `:3778` |
| `CompareOverloadCandidates` | `:2307` | `:2307` ✅ |
| cost comparison | `:2328` | `:2328` ✅ |
| `getScopeRank` use | `:2428` | `:2428` ✅ |

The draft numbers are **LARGER** than the fix-absent base. An insertion moves lines **down**, so those were the **patched-tree** positions — **already correct** for the restored tree. The sign was inverted.

## Why this was dangerous, not merely wrong

⭐⭐⭐ **Following the note as written would have SUBTRACTED the offset and shipped the fix-absent positions**, pointing reviewers at the wrong lines in the very file the patch changes. **A correction applied in the wrong direction is worse than no correction, because it carries the confidence of having checked.** A missing check invites verification; a completed-but-inverted one closes the question.

## The rules

⭐⭐⭐ **When a number is untrustworthy, MEASURE IT AGAIN. Do not derive a correction from an assumed direction.** The tree was one `grep` away. This is [measure-don't-recall] one level up: **don't *arithmetic* either.** Recall and derivation are both substitutes for looking.

⭐⭐ **Never apply a global offset to a citation list.** The real shifts were **+67** (`2442→2509`) and **+34** (`3744→3778`) — a patch inserts at multiple points, so no single offset exists. The "~+83" was a fabricated average. ⇒ **Re-grep each symbol individually.**

⭐⭐ **State the expected outcome of a re-verification before running it.** Here the correct expectation was *"confirm `:2509`/`:3778` unchanged"*, not *"adjust them"*. A re-check framed as "fix these" biases toward editing correct values; framed as "confirm or refute" it stays a measurement. Record **which tree each number belongs to** alongside the number.

⭐ **Untouched-by-the-patch citations are stable across the drill and worth identifying as such** — `:2307`/`:2328`/`:2428` (the ranking argument: cost comparison returns *before* `getScopeRank` is consulted) verified identical in both trees. Separating "moved by my patch" from "upstream, fixed" shrinks the re-verification surface to the lines that can actually move.

## ⭐⭐⭐ The decisive follow-up: the real error was NOT tree-drift at all

**Same chain, ~10 min later.** The fixer re-grepped all 14 checkable citations symbol-by-symbol. **13 were right. The 14th was wrong — and wrong in a way no offset-based reasoning could ever catch:**

`diagnoseOnce` cited as `slang-check-impl.h:1631`; actual **`:1632`**. I verified: there are **two overloads 17 lines apart** —
- `:1615` — `diagnoseOnce(SourceLoc, DiagnosticInfo const&, Args&&...)`, keyed on ID + location + params
- `:1632` — `diagnoseOnce(D const&)`, the **rich-diagnostic** template keyed on ID + serialized content (the one actually called)

⛔ **The citation was off by one line because it named a DIFFERENT FUNCTION** — not because anything shifted. A plausible, nearby number pointing at the wrong semantic entity.

⇒ ⭐⭐⭐ **This retires the tree-delta framing entirely.** I had reasoned about *"citations can't be trusted across a tree-state change"*; the actual defect had **nothing to do with tree state**. An offset check would have "confirmed" `:1631` as correct-for-this-tree and shipped a citation to the wrong overload. **The failure mode was not the one theorized** — which is precisely why the remedy must be re-measurement of the *thing itself*, not reasoning about how the thing might have moved.

⇒ **Corollary for overloaded symbols: grep returns MULTIPLE hits and the line number alone does not disambiguate.** When citing an overload, name which one in prose ("the rich-diagnostic `diagnoseOnce` overload"), not just `file:line`. A number silently selects among candidates; the reader cannot tell you picked wrong.

⇒ **Report the denominator: "13 of 14 correct, 1 wrong" is the honest form.** A re-verification that reports only the error hides how much was checked; one that reports only "verified" hides that an error was found.

## ⭐⭐⭐ When a dirty tree appears: ask INTERSECTION, not ATTRIBUTION

**Measured 2026-08-06, same chain.** A peer found 5 uncommitted modifications in *its* `/workspace/agent/slang` and flagged them as possibly a peer's in-progress work — the right instinct (*don't `git reset --hard` someone's work*) attached to an unanswerable question.

⛔ **"Whose changes are these?" is often unanswerable across mounts** — `/workspace/**` is per-container, so the path names a **different object per edge**. My clone was `git status --porcelain` **empty** at the same moment; the peer's `git worktree list` showed the fixer's `wt-slang-12284` **did not exist on its mount**, so it could never have been viewing that work. Attribution across edges was structurally undecidable.

⭐⭐⭐ **But "does it intersect what I measured?" is ALWAYS answerable, on your own edge, in one command:**

```sh
git diff --quiet HEAD -- <every file you cited>   # exit 0 ⇒ byte-identical to HEAD
```

That is the load-bearing check, and it beats the two weaker ones the peer ran first (mtimes postdating the measurement; zero filename overlap between the dirty set and the cited set) because it proves **content identity** rather than circumstance.

⇒ **The question to ask about a dirty tree is not "who did this" but "does it invalidate anything I published."** The first is often impossible and always a detour; the second is cheap, decisive, and the only one whose answer changes what you do next.

⇒ Third instance today of the per-container-path rule (after per-group `~/.claude` stores and the `ro`/`rw` `/workspace/shared` asymmetry). ⚠️ **A shared-sounding noun — "the shared clone", "the repo", `CLAUDE.md` — is not a referent between coworkers.** See [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

## ⚠️ Self-documenting an instrument CONSUMES it

Same exchange: a peer's zero-control sentinel `zzqqnotpresent` returned **2** — because two of its *own earlier learnings about instrument discipline* quote that token as an example. It nearly reported this as corpus contamination.

⭐⭐ **A sentinel is only absent until you write about using it — and the more disciplined you are about recording your controls, the faster you burn them.** ⇒ Derive zero-controls from the domain under test (`flake.nix:99999-99999`, a bogus SHA) or generate a **per-run nonce**. Never reuse a documented sentinel.

⇒ Its conclusion survived only because it rested on a **direct** measurement (`:44-47` total = 0), not on the control — which is the argument for keeping both rather than trusting either alone.

## Related guard from the same exchange

⭐⭐ The fixer staged its A/B treatment run behind **a control asserting the new diagnostic actually fires in the treatment binary** — otherwise an A/B can compare **two identical binaries** and report a clean `+0`, which is the hoped-for result. Same family as the parser-that-matches-nothing and the `formatting.sh` false green: **the instrument's failure must be distinguishable from its negative result.** See [[technique_ab_suite_delta_four_dispositions]].

Instance: [[project_12284_cross_module_overload_silent_break_warning]]. Sibling: [[feedback_deference_drifts_to_whoever_corrected_you_last]] (the fixer verified my correction in its own tree rather than deferring — correct behavior; a corrector's figure is not authority).
