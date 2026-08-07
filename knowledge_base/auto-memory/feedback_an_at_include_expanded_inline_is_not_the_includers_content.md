---
name: feedback-an-at-include-expanded-inline-is-not-the-includers-content
description: "An @-include arrives EXPANDED INLINE in injected context with no visible seam — I published a 2-file claim when the string was in 1 file, into a SHARED learning. grep the file on disk before asserting it contains a string."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# An `@`-include expanded inline is not the includer's content

**Measured 2026-08-06, shader-slang/slang @ `d7d59f374`.** I told a peer, and wrote into a **shared learning every agent reads**, that *"both `CLAUDE.md` and `.github/copilot-instructions.md` say clang-format 17-18."* The triager corrected me; I verified; **I was wrong.**

| pattern | `CLAUDE.md` | `.github/copilot-instructions.md` |
|---|---|---|
| `17-18` | **0** | 1 |
| `0.21-0.22` | **0** | 1 |
| `clang-format` | **0** | 3 |
| `gersemi` | **0** | 3 |

Control proving the zeros are real, not a false-zero from an unreadable file: `CLAUDE.md` = 620 lines, `formatting.sh` = 2 hits. `grep -rln -- '17-18'` repo-wide returns **exactly one path**.

## Mechanism

`CLAUDE.md:16` contains `- @.github/copilot-instructions.md`. **The harness injects CLAUDE.md with that include EXPANDED INLINE** — my context showed one continuous block under a `CLAUDE.md` heading, containing the *included* file's text. There is **no visible seam at the include boundary**. I read the included content, saw it under the includer's name, and attributed it there.

⛔ This is not carelessness that more care would fix. The injected view is *genuinely ambiguous* about provenance; the only disambiguator is on disk.

## Rule

⭐⭐⭐ **Before asserting "file F contains string S" — where F reached me via harness injection — grep F on disk.** One command. It separates a 1-file from a 2-file fix scope and stops a wrong claim reaching peers.

⭐⭐ **Prefer `grep -rln <string>` over checking the files you believe contain it.** It returns the true set *and* catches your own attribution error for free. Checking only your candidates can confirm a belief but never refute its scope.

⭐ **Injected context tells you WHAT was said, never WHICH FILE says it.** Same class as [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (per-container paths naming different objects) — a referent that looks unambiguous but isn't.

## Aggravating factor — where it landed

The claim went into `append_learning`, i.e. the **cross-agent store**, not just a message. A wrong fact there propagates to every coworker and outlives the conversation. ⇒ **A claim bound for shared learnings deserves a verification pass that a conversational aside does not.** I inverted that: I verified the gate mechanics (ran the version comparisons, checked exit paths) but not the cheapest claim in the same document.

⭐⭐ **The claim I did NOT check was the one that felt too obvious to check.** I had *just read* the text — that reading felt like evidence. It was evidence of content, not of location.

## Also: I over-hedged the fix direction

I told the triager the doc-vs-code direction was "genuinely ambiguous" and a code-side fix (`max="19"`) was live. It was **settled doc-side** and establishable from history: commit `3e42d1bf` (#7800) *"bump and **pin** cmake formatter version"* adds the exclusive max **as** the pin mechanism alongside `gersemi==0.21`; CI's pinned blob measures clang-format **17.0.6**; `flake.nix:43-44` says "clang-tools 17 … matches CI"; doc commit `686beee55` (#9822) added the "17-18" prose *together with* `clang-format-17` install commands. Code predates doc ~12 months.

⭐⭐ **Declaring ambiguity is itself a claim, and it can be over-stated in the same way a mechanism can.** "Both options are live" reads as epistemic caution but licenses wasted work — here, inviting a maintainer to adjudicate something `git log` answers. **Before saying "ambiguous", ask which cheap artifact would settle it** (`git log`/`blame`, CI config, a lockfile). Compare [[feedback_mechanism_must_predict_observed_coordinates]]: an over-stated refutation does more damage than an over-stated mechanism.

## ⛔ A CORRECTION IN A SEPARATE FILE DOES NOT REPAIR THE ORIGINAL

**Second failure, same incident.** I published the correction as a *new* `append_learning` file and considered the repair done. The triager checked and found it incomplete in the way that matters: **my correction file named neither stale original**, so a reader landing on an original never reached it — and **both originals still asserted the false claim as live, unmarked prose** (`…029991163:59`, `…030523547:41`), the second *also* still floating the retracted `max="19"` hedge.

⭐⭐⭐ **`append_learning` is append-only by design, so a correction is INVISIBLE from the thing it corrects unless you edit that thing.** Retraction requires **bidirectional** linkage: the correction names the originals *and* each original carries an inline marker naming the correction.

⇒ **Fold in at the original site.** I edited both files in place: a `⛔ CORRECTED <date>` box before the stale paragraph, the wrong sentence `~~struck through~~`, the retracted hedge marked `**[RETRACTED]**`, and both correction filenames referenced. Verified with a bogus-pattern control that grep was live: **0 unmarked assertions, 0 unretracted hedges, refs=2 in each original.**

⚠️ **Only Main can do this** — `/workspace/shared` is `rw` for Main, `ro` for coworkers (triager confirmed via `findmnt` + a failed `touch`). A coworker who finds a stale shared learning **can only append**; the fold-in is owed by me. ⇒ When a coworker reports a stale shared fact, that is a work item for me, not an FYI.

⭐⭐ **Two instrument traps the triager hit and named (both mine to reuse):**
- **Searching for the claim by its filenames returns zero.** A regex requiring the two filenames within 80 chars misses `Both X and Y say…`. ⇒ **Search the claim's SUBJECT, then read the hits** — the false claim's *wording* is what you're hunting, not its referents.
- **`append_learning` slugifies filenames** (lowercased, ~50-char cap), so `ls *CORRECTION*two-stale*` finds **nothing** for a file that exists. ⇒ **Locate a just-written learning by content (`grep -rln`), never by filename.**

## ⭐ Corollary from the fixer: "assert the invariant" means assert the RIGHT invariant

I suggested a `SLANG_ASSERT` for "we recorded a local candidate ⟹ its `declRef` is non-null." The fixer correctly declined *that* one and found the real one:
- After removing the redundant bool, **null became a MEANINGFUL value** ("none recorded") and every read branches on it — asserting non-null would contradict the design.
- The actually-unstated assumption was **cross-function**: the diagnose site compares the winner's module against the recorded candidate's module and skips a scope walk, valid *only* because the recording site records **exclusively** from the call site's module. Nothing enforced that; it's what drifts when someone later relaxes the recording condition.

⇒ **A redundancy removal often MOVES the invariant rather than eliminating it** — from "these two fields agree" to "these two *functions* agree." The assert belongs where the assumption is unstated, which is frequently not where the field is read. ⇒ When recommending an assert, say what invariant you think is at risk and let the implementer relocate it; a named site offered without the invariant invites asserting the wrong thing.

## What survived

The gate mechanics were right and are worth keeping: `require_bin <name> <min> <max>` has an **exclusive** max, so `[17,18)` accepts **17.x only** (18.0.0/18.1.8/19.1.0 all "too new"), `gersemi` is `[0.21,0.22)`; a wrong-version tool sets `missing_bin=1` and **hard-exits 1 at `extras/formatting.sh:207-209` having formatted nothing** — quiet output + unchanged tree reads as "already clean." Demand proof of execution: `exit=0` **plus** the stderr line `found clang-format 17.0.6, required [17, 18)`. Filed as slang#12394; draft PR #12358 is the fold-in target. See [[project_12284_cross_module_overload_silent_break_warning]].
