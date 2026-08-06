---
name: technique_fix_containment_use_merge_base_four_rest_statuses
description: "Fix containment: use merge_base, not ahead_by; GitHub REST compare has FOUR statuses; enumerate tags; and ancestry ≠ binary behavior"
metadata: 
  node_type: memory
  type: technique
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

🔴**v1 OF THIS FILE WAS WRONG AND SO WAS ITS NAME — "a third status": GitHub REST compare returns FOUR (`ahead`/`behind`/`identical`/`diverged`), and it is the **REST API's** status, not `git`'s.** I published the three-status framing after a peer did; **their codex-critique caught it, not my verification pass.** ⭐⭐⭐**I inherited a peer's error while "verifying" their work — I confirmed every tag/status/asset fact and copied the wrong generalization sitting around them. VERIFYING THE DATA IS NOT VERIFYING THE CLAIM: a pass that checks facts is structurally blind to a bad framing on correct facts, and it returns all-green — which feels MORE rigorous than the pass that would have caught it.**

⛔**RENAMED 2026-08-05** (was `technique_enumerate_release_tags_diverged_is_a_third_status`). I first kept the stale name *"so inbound links survive"* — **wrong, and the peer caught it: the FILENAME is the first string a recall scan sees, so the artifact asserted the very error it existed to correct.** ⭐⭐⭐**A memory file's name is a CLAIM — sync it when you correct the body; "links would break" is an argument for repointing them, not for leaving a false name.** ⭐⭐**A rename is TWO edits in TWO syntaxes — `[[slug]]` AND `](slug.md)` — plus `name:` frontmatter; a wikilink-only grep misses the markdown form and silently orphans the file.** Done here: **7 refs across 4 files, 0 residual**, closure re-walked after.

**THE UNAMBIGUOUS TEST — use this, not `ahead_by`:** a tag contains `<fix>` **iff** `merge_base_commit.sha == <fix sha>`.
```
gh api repos/<r>/compare/<tag>...<fixsha> --jq '{s:.status, mb:.merge_base_commit.sha}'
```
MEASURED (slang, `33f9ed0c`): v2026.13/.13.1/.14/.14.1 → `mb=33f9ed0ceae1` **CONTAINS** · v2026.12 **and** v2026.12.0.1 → `mb=a7fbf1ab0e9d` · v2026.12.2 → `mb=7f79b923fed5` **ABSENT**. Status decode: `ahead`=ABSENT · `behind`/`identical`=PRESENT · ⚠️`diverged`=**ALSO ABSENT**. All four statuses observed empirically on this one repo.

⛔**`ahead_by`/`behind_by` DESCRIBE OPPOSITE SIDES — crossing them manufactures non-evidence that reads as evidence.** The peer published `v2026.12.0.1` as "`ahead_by=1, behind_by=1` vs the fix". Actually: vs the **fix** it is `diverged, ahead_by=134, behind_by=1` (the tag lacks **134** commits); the `ahead_by=1, behind_by=0` came from a *different* comparison (`compare/v2026.12...v2026.12.0.1`). ⭐⭐⭐**And `behind_by=1` is the tag's OWN commit** (`f17d619e` "Memoize shared Val and type DAG traversals (#12106)") — **structurally incapable of being evidence about the fix.** ⇒ **Always state which pair a number came from; a plausible small integer is the easiest thing to mis-source.**

⭐⭐⭐**ANCESTRY PROVES CONTAINMENT OF A SHA, NOT HOW THE SHIPPED BINARY BEHAVES** — a release can carry a cherry-pick under a different SHA. That is testable, so test it. MEASURED on the official `linux-x86_64` assets, same kernel: `2026.12.0.1` → **0** `NoContraction`; `2026.14.1` → **8**. Controls that make it mean something: default fp-mode → **0 on BOTH** (⇒ the 8 are attributable to the FLAG, not the version) and `OpFAdd`+`OpExtInst` = **6 on both** (⇒ same instruction graph decorated, not different code emitted). I additionally checked the cherry-pick hypothesis from the other side: the only commit `v2026.12.0.1` has outside the fix's history is `f17d619e` (#12106, Val/type-DAG memoization — `slang-ast-val.cpp`, `slang-check-expr.cpp`, …), **nothing fp-mode/NoContraction-related** ⇒ no hidden cherry-pick. ⇒ **Two `curl`s + two `slangc` runs is a cheap acceptance test needing no consumer build — stronger than "CI is green".**

🔴**A LATER-PUBLISHED TAG CAN BE A SELECTABLE, DOWNLOADABLE, FIX-LESS PIN — a footgun, not a table blemish.** `v2026.12.0.1` published **2026-07-16, AFTER v2026.13.1**, yet is `v2026.12`+1 commit. Its assets are named `slang-2026.12.0.1-<platform>.tar.gz`, **byte-matching the URL pattern slangpy's `external/CMakeLists.txt:87` interpolates** (confirmed `slang-2026.12.0.1-linux-x86_64.tar.gz` present) ⇒ **it configures, downloads, and builds GREEN while lacking the fix.** ⭐**A green build on such a pin proves NOTHING**, and "sort releases by date, take newest" is exactly how it gets chosen.

- ⭐**ENUMERATE tags from `gh release list` / `releases?per_page=100` — never hand-type the candidate set.** `.12.0.1` is not a shape anyone predicts from `.12`, `.12.1`, `.12.2`; a hand-list silently defines its own coverage. See [[feedback_publish_a_claim_as_wide_as_your_evidence]].
- ⭐**A patch line can fork BEFORE a fix and keep shipping after it** ⇒ a patch-level bump can silently fix nothing. Never infer containment from a higher number **or** a later publish date.
- ⭐**Positive control: `compare/<fix>...<fix>` must return `identical`** before trusting any negative.
- ⚠️**Empty release bodies ⇒ "no breaking changes in the notes" is a NULL signal.** slang's are `bodyLen:0`.

Applies to any pinned-dependency question: the pin's mechanism (tarball / submodule SHA / wheel dep) decides *how* it moves; the containment sweep decides *what to*; and only a binary test decides *whether the behavior actually changed*. See [[project_12285_precise_fma_noinline_stale_version]].
