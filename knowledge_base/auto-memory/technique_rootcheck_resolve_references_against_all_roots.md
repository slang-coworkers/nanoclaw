---
name: technique_rootcheck_resolve_references_against_all_roots
description: "bin/rootcheck.py — resolves references across all 10 roots, filename variants, then the `name:` slug index, cheap→expensive with per-branch labels so NECESSITY is readable. Caught its own bug 3× (wrong-root, wrong-key, first-hit-wins). ⛔ A disjunctive resolver reports which branch FIRED, never which was NECESSARY. Control the CLASSIFIER (planted positive), not just the reader (must-hit)."
metadata: 
  node_type: memory
  type: technique
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

# `bin/rootcheck.py` — the universe checker

```
python3 bin/rootcheck.py <file.md ...> [--target NAME] [--root DIR] [--quiet-resolved]
```
**Exit 0 = all targets resolved somewhere + controls sound · 1 = real unresolved · 2 = CANNOT VERIFY**

⭐⭐⭐ **Why a third tool.** `fragcheck` asks *"is X present in this artifact?"*; `nbrcheck` asks *"what did
this region contain before I replaced it?"* — **both operate inside ONE universe, so neither can detect a
probe aimed at the wrong one.** Six measurement errors on 2026-08-05 split into two tiers:

| tier | instances | caught by |
|---|---|---|
| 1 — wrong scope **within** a universe | `#if 0` line-range read · `index-*` excluded from the denominator · `41062` vs `41,062` | widen the set / vary the pattern; must-hit control |
| 2 — **wrong universe entirely** | `-1` from the wrong index file · peer resolving relative names against root A while rows named root B · my "no path to a peer's tree exists" while 6 peer roots were mounted | **only** a target known to live in the *other* universe |

**Tier 2 is invisible to every tier-1 guard** — no amount of adding files from root A ever contains a
root-B target.

**10 roots discovered in this container** (the tool prints them with rw/ro and file counts, so the universe
is visible in every run rather than assumed): my live lessons store (705), `/workspace/agent/memory` (73),
`/workspace/shared/learnings` (2943), `/workspace/shared/wiki`, plus **6 peer stores under
`/workspace/extra/ephemeral/prod-groups/<peer>/memory` — READ-ONLY** (slang-fixer 309, slang-triager 500,
slangpy-triager 42, …). ⚠️ The visible peer root is **not** the store a peer reports on — see
[[feedback_identical_paths_hold_different_files_per_agent_group]].

⛔ **IT REPRODUCED ITS OWN TARGET BUG ON FIRST WHOLE-STORE RUN.** v1 checked absolute targets *literally
only*, so the six rows naming `/workspace/agent/memory/triage-12285.md` — which exist under a **peer** root
— were reported **UNRESOLVED**. That is a single-root verdict wearing a multi-root tool's output: 91 false
"missing". Fix: absolute target → check literally, then **retry by basename across every root** → 91 drops
to 60, with 29 correctly reclassified as *resolves in a different root*.
⇒ **A tool built to catch a class is not exempt from that class.** Same shape as
[[feedback_a_remedy_that_can_reproduce_its_own_bug]].

✅ **Controls run unconditionally** (fragcheck's rule): a planted absent target must report missing, a
harvested known-present target must resolve, and **<2 roots ⇒ exit 2** — with one universe the tool
degenerates into exactly the check it was built to replace, so it refuses rather than certifying.

**Real defects it found, store-wide (823 targets):**
- **8 truncated wikilinks** — `[[project_11989...]]`, `[[project_8125...]]` etc.: an author abbreviated the
  slug instead of writing it. **7 repaired** (targets existed all along); `project_12148` has no target
  anywhere and `[[...]]`/`[[feedback_...]]` are prose ellipses.
- **1 ambiguous name** in two roots — itself a finding, so the tool never stops at the first hit.
- Remaining 60 unresolved are prose examples in `[[ ]]` (`texture`, `sampler`, `x`) and refs to
  non-memory artifacts (`/workspace/agent/reports/…`, `/workspace/inbox/…`) — correctly *not* memory gaps.

⚠️ **My own slip while repairing, worth the reminder:** I ran a replace against `project_12203…` because I
had *assumed* it held those links; `grep -l` showed they lived in four different files. **`replaced 0` is
the tell — a repair that reports zero changes did not fail safely, it failed silently.** Locate by
`grep -l` before editing, never by recall.

⭐ **The peer's framing that motivated building this:** *the fix isn't more rules but converting them into
instruments that run.* Three times in one session a rule I already held failed to fire at the moment it
applied — **retrieval failure, not knowledge failure.** A rule you must remember to invoke is not a rule.

⭐⭐ **v3 — the THIRD tier-2 variant: right root, WRONG KEY** (peer-found, then measured here). A
`[[link]]` may address a memory's **`name:` slug**, not its filename. v2 resolved by filename only, so it
called 3 good links broken; the peer's equivalent called 37. v3 indexes `name:` per root and reports it as
its **own** bucket — collapsing it into "different root" would hide the fix, because the two have different
remedies: **wrong-key is fixed in the RESOLVER, different-root is fixed in the REFERENCE.**

⛔ **This store's split (722 files, `name:` on 714) — and why "index the field" is the right fix but NOT a
gap-closer:**

| class | n | addressable by `[[ ]]`? |
|---|---|---|
| `name:` == filename | 577 | yes |
| mechanical hyphen-for-underscore | 52 | yes |
| free-text **containing spaces** | **71** | **NO — outside the addressing scheme** |
| free-text, hyphenated but drifted from filename | 15 | yes |
| empty `name:` | 0 (peer had 8) | n/a |

**71 of 86 free-text slugs contain spaces** (`name: Drafts-only PR guardrail`), and the wikilink regex
`[[([A-Za-z0-9_.-]+)]]` rejects them — verified with a must-match control on a hyphen slug. ⇒ **The honest
claim: indexing `name:` recovers the addressable-but-differently-keyed cases; the free-text-with-spaces class
is unreachable BY CONSTRUCTION, not by resolver deficiency.** A resolver cannot be sold as closing that gap.

⇒ **Load-bearing count is what sizes the fix: only 3 of 138 mismatches are actually LINKED by slug**
(control: the probe returns 1 for a known-linked slug, so the zeros are real). So the wrong-key defect is
real but narrow: **the actionable set is 3, not 138.**

⛔ **RETRACTED, same day — I recorded the peer's "near-inert in my store" as fact and it was wrong.** I wrote
that the peer's store (`name:` on 183/691 ≈ 26%, mostly free-text) made this remedy near-inert there, versus
mine (714/722). The peer then measured **demand** rather than population: **7 of its slugs are LINKED and
resolve only by `name:`** — MORE than my 3, in the store we had both just declared it wouldn't help.
⇒ ⭐⭐⭐ **`name:` COVERAGE PREDICTS NOTHING ABOUT WHETHER SLUG-INDEXING PAYS.** What decides it is how many
*linked references* use the slug — small in both stores (3 / 7) and **non-empty in both**. The remedy is
worth it in both, for the same reason, at the same tiny scale. One of the peer's 7
(`no-autofixer-jkwak-self-filed`) is a *shortened* slug no normalizer recovers, so this is not reducible to
hyphen-vs-underscore.
⇒ ⭐⭐ **Rank by the variable that DECIDES the outcome, not the one you can count.** Both of us measured the
easy-to-reach property (how many files carry the field) to answer a question about a different property (how
many links need it). Same class as ranking by recency to answer a question about darkness.
⛔ **PREMISE CORRECTED by the peer (same day): the "26% coverage, mostly free-text" figure was a
COMBINED-ROOT AVERAGE describing neither store.** Split: **root A 181/193 = 93.8%**, **root B 2/505 = 0.4%**.
⇒ **The peer's root A and this store have the SAME shape** (near-universal `name:`, rule files); root B is a
different **artifact class** (chain memos). Averaging two populations produced a statistic true of neither —
and it was the premise under the "inverse shape" claim already retracted above.
✅ **I verified the half I can reach:** root B is `find`-recursive **505** `.md` (top-level `ls` gives 501 —
4 live in subdirs, so a top-level glob under-counts), and **`name:` on exactly 2** — matching the peer's
0.4%. Root A remains unreachable, so its 93.8% stays attributed.
⇒ ⭐⭐ **Never average across artifact classes.** "Coverage" over rule-files + chain-memos is not a property
of anything; split by class first, then state each.

⭐⭐ **THIRD `name:` STATE: present-but-vacant (`name: ""`).** It **satisfies a "has a name?" check while
being unaddressable** — the peer has 8; disambiguating them took stripping quotes *before* testing emptiness
(its earlier pass compared `""` as content and returned 0; both passes were right about different
predicates). **This store: populated 717, empty-but-present 0, absent 8** — `MEMORY.md`, the archive, and the six
`index-*.md`. ⛔ **I first called these "exempt by spec" and that was SLOPPY: the OKF spec exempts the
LITERAL names `index.md` / `log.md`, and mine are `index-feedback.md` etc. — not literal matches, and they
carry `type: index`.** The correct reason they are **not gaps** is the peer's discriminator, measured:
their `[[index-feedback]]`-style links **resolve by filename** (rootcheck: 3/3 resolved-in-primary), so
nothing points at an unaddressable target. ⇒ **zero real gaps here — but by resolution, not by exemption.**
⛔ **RETRACTED (peer's own correction, minutes later): the "contrast" collapsed — ZERO real gaps in BOTH
stores, by the SAME mechanism.** I had recorded the peer's 8 as *real, actionable* (`type: project`/`feedback`,
linked 18×/13×, "unaddressable by slug"). The peer then ran its own discriminator on its own store: **all 25
wikilinks pointing at those 8 use the FILENAME STEM** (`[[evidence_discipline_lessons]]` — underscored,
matching the file), so they resolve by filename exactly as mine do. **The vacant `name: ""` is never the key
anyone used.**
⇒ ⭐⭐⭐ **RESOLUTION IS THE ONLY DISCRIMINATOR THAT EVER MATTERED.** `type:`, vacancy, and link-count all
looked load-bearing and none is. **A census stopping at "8 files lack a usable name" reads identically in
both stores — and the count carries no information at all.** Ask only: *does anything point at it, and does
that pointer resolve?*
⭐⭐ **The peer's diagnosis of its own error is the transferable part: it had the right discriminator, stated
it, applied it to MY store, and skipped it on its OWN — asymmetric application, in the direction that made
its finding look more interesting.** Not a missing rule. ⇒ **Run a discriminator on your own side FIRST;
that is the direction where a skip flatters you.**
⛔⭐⭐⭐ **RETRACTED — MY "3 SLUG-ONLY LINKS" WERE NEVER SLUG-ONLY. FIRST-HIT-WINS.** v3 tried the slug
index and returned on success, so "resolves via slug" was a fact about **my resolver's evaluation ORDER**,
not about the link needing a slug. Necessity test (peer-prompted): **all 3 resolve by the
hyphen→underscore filename variant** — `feedback-verify-elapsed-time-from-live-artifact` →
`feedback_verify_elapsed_time_from_live_artifact.md` EXISTS, same for the other two. The slug index was
**sufficient but not necessary for any link in this store.**
⇒ ⭐⭐⭐ **A DISJUNCTIVE RESOLVER REPORTS WHICH BRANCH FIRED, NEVER WHICH BRANCH WAS NECESSARY.**
Establishing necessity requires running the **cheaper branches and seeing them FAIL**. Both of us shipped
this bug independently, in tools built *after* cataloguing the neighbouring-question class.
✅ **v4 fix: cheap normalizer BEFORE the slug index, and a distinct label per branch** (`via filename
variant` vs `via slug ONLY`). Result: the slug-only bucket is **EMPTY across all 849 targets** — and a
planted control (`name: zz-control-slug-only-probe` in a file whose stem differs) **does** land in the
bucket, so the zero is measured, not an inert branch.
⇒ **Honest scope, final: slug-indexing costs nothing and is load-bearing for 0 links here, 1 target /
5 instances in the peer's store** (`no-autofixer-jkwak-self-filed`, a *shortened* slug). Structural norm
confirmed: **727 of 773 targets resolve as a plain filename stem.**

⭐⭐ **Why keep the slug index anyway — the peer's argument, and it is better than "insurance": it covers
exactly the class NO transformation covers.** Slug drift splits by KIND, and only one kind is reachable by a
normalizer:

| drift kind | n (this store) | reachable by normalizer? |
|---|---|---|
| separator only (`-` ↔ `_`) | **52** | yes — cheap variant branch |
| **prefix / stem rewrite** | **17** | **NO — only the `name:` field** |

The 17 are cases where the slug drops or rewrites the type prefix or the stem itself:
`name: 12137-aarch64-apt-fetch-ci-flake` ← `project_12137_aarch64_apt_fetch_ci_flake.md`;
`name: don-t-group-restart-a-benign-ack-loop-…` ← `feedback_benign_ack_loop_dont_restart_if_live_chains.md`
(a *different sentence*, not a transformation). The peer's live case is this kind — a prefix difference — which
is why theirs survives necessity and my three did not.
✅ **But possibility ≠ demand: 0 of my 17 are LINKED anywhere** (control: the probe returns 1 for a
known-linked slug). So the index is *unexercised* here, not *unnecessary* — it is the standing guard for a
drift kind that exists in 17 files and would be silently unresolvable the moment anyone links one.
⚠️ **The peer's 25-wikilink measurement is UNVERIFIABLE from here** (`evidence_discipline_lessons.md` /
`counting_repo_wide_with_gh.md` absent from the readable root B — control: `triage-12285.md` found). Both
its claim and its retraction rest on its own authority; recording the retraction, attributed, is what keeps
the chain repairable — measured *within frontmatter
only*, with a planted-file control.
⛔ **My first attempt at that count was a false positive, on the decoy the target file itself warns about:**
`grep -c '^name: *""$' *.md` returned 1 — at **line 18 of
[[feedback_empty_frontmatter_makes_a_memory_unreachable]]**, i.e. inside the BODY quoting the pattern, while
that file's real frontmatter `name:` is populated. ⇒ **A frontmatter predicate must be evaluated inside the
frontmatter** (slice at the `---` terminator), never by whole-file grep. That file's own description
prescribes exactly this and I still hit it — retrieval failure, not knowledge failure, one more time.

⚠️ **I could not verify the peer's 7 myself** — its measured store is root A (186 files), and the peer root
*visible* to me is root B (501 files, `name:` on **2** — a different store). `find … -path '*claude*' -name
MEMORY.md` → 0 with a must-hit control at 3, so root A is genuinely unreachable. Recorded on the peer's
authority, explicitly not independently confirmed. See
[[feedback_identical_paths_hold_different_files_per_agent_group]].

⛔ **NO MASS RENAME.** 138 files to satisfy a convention no spec enforces is the destructive-remedy shape
([[feedback_a_remedy_that_can_reproduce_its_own_bug]]) — and for the 71 it would not even confer
addressability without redefining what the field means.

Related: [[technique_fragcheck_controls_inside_the_tool]] ·
[[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]] ·
[[feedback_a_line_range_read_inherits_enclosing_preprocessor_scope]] ·
[[feedback_verify_a_summary_count_against_the_rows_not_the_previous_count]].
