---
name: feedback_a_plausible_wikilink_name_is_a_fabricated_citation
description: "TRIGGER — writing any [[link]]: resolve the target against the corpus FIRST, never type a name you believe should exist. Measured 33 fabricated/misnamed citations store-wide, all plausible names for rules I really hold. A dangling link is invisible: my gate measures reachability INWARD (is this leaf pointed at?) and never checks whether MY OUTBOUND citations resolve."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1eeebc25-4a20-4d12-99f0-c47b6ee02c1a
---

# A plausible `[[wikilink]]` is a fabricated citation, and nothing in this store checks it

**Measured 2026-08-08, store-wide.** `slang-triager` found 7 dangling outbound links in its own store
(all invented names for rules it genuinely holds) and told me the *check* transfers even though its
*outcome* wouldn't. It was right twice over.

## What the store-wide sweep found

| aperture | result |
|---|---|
| my first pass — 7 files I'd touched today, filter `'_' in link` | **0 dangling of 37** ✅ |
| store-wide, no shape filter | **6127 wikilinks, 115 unresolved targets** |
| of those, **genuine citation attempts** (leaf-family prefix, no code punctuation) | **33** |
| ⭐ after **stripping code spans** (peer's step — a link in backticks is an *example*) | ⛔ **31** |

⭐⭐⭐ **STRIP FENCED BLOCKS AND INLINE CODE SPANS BEFORE CLASSIFYING** (peer's addition, verified here:
33 → 31; on its edge 41 → 25). **A wikilink inside backticks is a demonstration, not a citation** — and
without this step the two files that *document this very trap* get convicted for their own
illustrations. Exonerated on my edge: `[[project_11989...]]` and `[[project_8125...]]` (both quoted
examples in `technique_rootcheck_resolve_references_against_all_roots.md`) and
`[[project_12430_..._ice.md]]` — quoted inside **this leaf**, as an example of a bad link. Run this
before repointing anything, because mis-repointing is the one irreversible move.

**All 33 are plausible names for rules I really hold** — e.g.
`[[feedback_a_bail_is_not_a_pass]]`, `[[feedback_a_control_that_fires_by_luck_is_not_a_control]]`,
`[[feedback_no_autofixer_jkwak_self_filed]]`, `[[feedback_a_tool_that_silently_collapses_output_reports_a_true_number]]`,
`[[technique_grep_in_repo_a_says_nothing_about_repo_b]]`. The rules exist; the *names* were typed from
belief. Several more are truncations (`[[feedback_...]]`, `[[project_12148...]]`) and one keeps the
`.md` extension (`[[project_12430_..._ice.md]]`), which does not resolve.

## Why this is invisible by default — the asymmetry in my own gate

⭐⭐⭐ **`reindex.sh --check` measures reachability INWARD: "is every leaf pointed at by something?"
It never asks "does every link I wrote point at something?"** So `ORPHANED=0` is fully compatible with
33 broken citations, and I have reported that zero repeatedly this session as though it certified the
store. It certifies one direction only.

⇒ A dangling citation degrades exactly the thing the store exists for: a future session follows
`[[feedback_a_bail_is_not_a_pass]]`, finds nothing, and concludes **the rule was never recorded** —
when it is sitting there under a different stem. **A fabricated link is worse than no link**, because
absence prompts a search and a broken pointer terminates one.

## My detector had the same defect as my figures, one layer up

⛔ My first sweep filtered candidates with `'_' in link` to skip prose placeholders. That is the
**"has a hyphen" predicate in a new costume** — it silently dropped **66 of the 115** unresolved
targets, including real prose citations like
`[[Do NOT autonomously close issues/PRs — surface to a human maintainer]]`. ⇒ ⭐⭐⭐ **Third instance in
one session of a shape-specific predicate defining its own population** (the others:
`159`-really-`179`, and my `8 vs 4` self-tally). **The filter that makes output readable is the filter
that decides what you can see.**

⚠️ **The opposite error is equally live: most of the 115 are NOT defects.** `[[vk::binding]]`,
`[[texture(0)]]`, `[[nodiscard]]`, `[[noreturn]]`, `[[required_threads_per_threadgroup]]`,
`[[:space:]]`, bash `[[ -z "$x" ]]` — Slang/Metal/C++ attribute syntax and shell tests that merely
*look* like wikilinks. A sweep that reports 115 "broken links" is crying wolf; one that reports 33
citation attempts is actionable. **Classify before counting** — and note the peer hit the mirror image,
re-introducing 2 dangling links by writing `[[link]]`/`[[name]]` as prose examples of the syntax.

## How to apply

- ⭐⭐⭐ **Corpus-first, never name-first.** Before writing `[[x]]`, resolve it:
  `ls | grep <keyword>` or `grep -rl '<distinctive phrase>' *.md`. If you are typing a name because it
  is what the rule *should* be called, you are fabricating a citation. This is the same discipline as
  [[technique_rootcheck_resolve_references_against_all_roots]] and the same failure class as citing a
  file you have not opened.
- ⭐⭐⭐ **Grep CONTENT to find a rule's home, not its name** — `name:` is not an identifier here
  (179/1056 mismatch their filename), and the rule may live inside an aggregate file rather than its
  own leaf. Peer's 5-of-7 lived in `evidence_discipline_lessons` / a different stem.
- ⭐⭐ **`ORPHANED=0` is a one-directional claim; say so when quoting it.** Outbound-link integrity is
  a separate measurement that this store's gate does not make.
- ⭐ **A clean result on files you touched today says nothing about the store.** My 0-of-37 was true
  and nearly worthless: wrong population, filtered detector.

⛔ **NOT REPAIRED — 31 candidates as of 2026-08-08** (33 before the code-span strip). Repointing each
needs a content-grep to find the real home, and mis-repointing is worse than leaving it. Recorded
rather than rushed; the buckets and method above are what a repair pass should start from. Do **not**
treat this leaf's existence as evidence the store is clean.

## ⛔ RE-MEASURED 2026-08-10: still 33, and I added a 34th while this leaf sat in my store

Same classifier, same code-strip, two days later: **129 raw unresolved → 33 genuine citation attempts**.
Spot-checked four names this leaf itself listed — `feedback_a_bail_is_not_a_pass`,
`feedback_a_control_that_fires_by_luck_is_not_a_control`, `feedback_no_autofixer_jkwak_self_filed`,
`feedback_a_tool_that_silently_collapses_output_reports_a_true_number` — **all four still dangling.**
The population is not drifting; it is *untouched*.

⛔ **And on 08-10 I wrote a fresh one**: `[[feedback_a_rule_welded_to_a_false_instance]]`, typed from the
phrase *"a rule welded to a false instance"* that appears as **prose inside MEMORY.md's ANCHOR C
carve-out** — not a leaf title. Exactly the name-first failure this leaf forbids, committed while the
leaf was indexed and reachable. Found only because a peer reported the same class on *their* store
(15 raw → 11 documented false-positive classes → **1 real**, a filename written from memory) and I
re-ran mine. Fixed by pointing at the carve-out in prose instead.

⇒ ⭐⭐⭐ **A leaf that documents a failure class does not prevent it — this is a holding-≠-applying
instance with the artifact sitting in my own index.** Per MEMORY.md ANCHOR E: a tell you designed but
did not *build* is worth zero. The buildable version here is a pre-write resolve (`ls | grep`) and a
post-write outbound-link check; prose in a leaf is neither. Adjacent instance from the same day:
[[feedback_i_attributed_my_own_figure_to_the_wrong_command]].

⭐⭐⭐ **REPORT BUCKETS, NEVER A RAW COUNT — a "broken links" number is a claim about your classifier,
not about your store.** My 115 → 33 → 31 and the peer's 41 → 25 → 8 → 3 are the same lesson. Its
bucket breakdown is worth copying, because two of its categories are **not defects at all**:

| bucket | disposition |
|---|---|
| `[[learning: …]]` refs (7 on its edge) | **different namespace** (shared learnings, not leaf stems) — can never resolve against `**/*.md`, not a defect |
| target/attribute syntax (10) | `[[vk::binding]]`, `[[kernel]]`, `[[color(N)]]`, `[[nodiscard]]` — language syntax, not links |
| deliberate syntax demonstrations | intentional; leave them |
| citation candidates (8) | only **3** had a confirmed home and were repointed |

⚠️ **And the peer left 5 of 8 dangling ON PURPOSE**, adopting the reasoning above: two were syntax
demos, one self-labelled placeholder prose, and **two named leaves that were never written** — a
dangling pointer to a non-existent rule is honest; inventing a target for it is not. ✅ Its one
confirmed repair is my exact class: `[[no-autofixer-jkwak-self-filed]]` →
`feedback_no_autofixer_jkwak_self_filed`, the leaf existing all along — the
`name:`-is-not-an-identifier finding showing up as a broken link.

⛔ **But do NOT read that as a mechanical fix, and I mis-summarised it as "hyphen-vs-underscore" —
peer's correction.** The repair was a hyphen→underscore swap **plus a `feedback_` prefix addition**, so
a bulk `tr '-' '_'` transform would **not** have resolved it. ⇒ **The hyphen pattern predicts WHICH
candidates are cheaply fixable; it never predicts WHAT the target is.** Content-grep per candidate
stays the only reliable move — which matters because a bulk transform over 31 links would silently
manufacture wrong pointers, the one irreversible failure here.

⚠️ **Checked for a prior leaf before filing this one** (the rekey-not-duplicate rule): content-grep
found `feedback_orphaned_zero_validates_the_root_you_ran_in_not_the_root_you_wrote_to`, which is about
**which root the gate ran in** — no coverage of outbound links or classification. So this is new
territory, not a second copy. A sibling of the peer's had already documented the classification defect
on *its* edge, making that a rediscovery there but not here — **our stores diverge, so "the peer
already has it" is not evidence I do.**
