---
name: project_approver_pipeline_defects_devin_fetch_ci_green
description: "Three approver-pipeline defects surfaced on slangpy#1090, mine-verified in my own skill files. D1: devin-fetch.sh accepts a CI-checks counter as a done-signal → false-clean exit 0 (SETTLED LIVE by slang#12142). D2: ci_green_on_sha reads only the legacy combined-status API, blind to Actions check-runs → green on bots' word beside red builds (LATENT: inert under require_ci_green:false, but :183 defaults True on absent key). D3: a submodule gitlink hides 608 lines from every size/path clause. Fixes NAMED, none applied (out of bounds)."
metadata:
  node_type: memory
  type: project
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# Approver-pipeline defects — `devin-fetch.sh` readiness, `ci_green_on_sha`, submodule gitlink

Surfaced by `slangpy-pr-approver` while deciding shader-slang/slangpy#1090 (2026-08-03..05) and
**mine-verified in my own `/home/node/.claude/skills/` copies** — not relayed. All fail *toward
clean/green*, the dangerous direction. **I changed nothing** — a fix must land where the containers
actually read, and loosening a CI predicate / safety regex unilaterally is out of bounds
([[project_critique_gate_pulls_pattern_builtin_floor]], [[feedback_shared_index_is_generated_use_shared_root]]).

## D1 — `devin-fetch.sh` readiness matches a CI-checks counter → false-clean exit 0

`DONE_EXPR` (`:109`) accepts `Checks\s*\d+\s*/\s*\d+` as a done-signal — a string about *GitHub CI
progress*, not about Devin's analysis being complete. Paired with a vacuous `heading` (⭐ **177/177
archived pages carry it — it is a static label, so `done = heading && summary` collapses to `summary`
alone**), a page showing the heading + a CI counter reads as done with an empty flags section.
**SETTLED LIVE:** slang#12142 exited 0 on a page reading `No analysis available`.

✅ **The fix, and the only rationale that survives — gate exit 0 on a positive verdict token in the
SCRAPED OUTPUT**, because it is the last gate before success, so it holds however the page got there:
```
grep -qE '\b[0-9]+ (Bugs?|Flags?)\b|\bNo (bugs|flags)\b' "$OUT/devin-flags.md" || exit 3
```
Secondary: drop the checks-panel terms from `summary`; add `No analysis available` as a degraded token.
⭐⭐⭐ **When the causal story is contested, fix at the gate closest to the decision** — two edges built
two entry-condition mechanisms from the artifacts each held; both were wrong; the last-gate fix derived
from neither was right. A fix at an entry condition dies with its mechanism; a fix at the last gate
survives being wrong about the cause.

⛔ **Which script slangpy actually runs is NOT established** (its skill tree references no runner;
`devin-page.txt` is written only by the two runner copies). Defect confirmed in scripts I have read; that
one of them produced the slangpy exit-0 is unproven — this leaf's own rule (find the invocation, never the
better file) was dark to me for the whole exchange.

## D2 — `ci_green_on_sha` blind to Actions check-runs

`eval-clauses.py:181-197` reads CI green from `commits/{sha}/status` only — the legacy **combined status**
API (`grep -cF 'check-runs'` = 0 in both approvers). GitHub Actions jobs are **check-runs**, not commit
statuses, so a repo whose CI is pure Actions reports combined `state: success` from bots
(`CodeRabbit`/`license/cla`) while **every build is invisible** — on #1090 that was `success` from 2 bot
contexts while 16 check-runs (12 `build (...)` legs, 4 red) went unseen.

**Severity is policy-dependent — LATENT, but scheduled to bite:**
- Inert only under the mounted `v0-shadow-wide` policy (`require_ci_green: false`, human-signed by
  haaggarwal 2026-08-04) which takes the `:184` skip path.
- 🔴 `:183 policy.get("require_ci_green", True)` **defaults True on an absent key** ⇒ **a lost/unmounted
  policy silently opts into the buggy path today**, no policy change required.
- The wide policy carries an explicit **`MUST BE RE-TIGHTENED BEFORE ANY ENFORCEMENT`** condition ⇒ the
  substantive `:190` path *will* be exercised by written commitment. ⭐⭐⭐ **A defect inert only because of
  an explicitly-temporary setting is a SCHEDULED failure, not low priority.** Sequencing:
  `require_ci_green: true` must NOT land before the check-runs fix.

✅ **Fixes:** (a) read `commits/{sha}/check-runs` (paginate — `total_count > len` short-counts silently),
not just combined status; (b) **distinct statuses, not prose** — the clause emits identical `pass` on two
grounds, `:184` "policy does not require CI green" and `:190` "combined status=success", so a consumer
keying on `status` cannot tell "checked, green" from "never checked"; add an `unevaluable` branch for "no
build signal." That prose-only distinction **enabled three rounds of error, including the author's.**
✅ **New tripwire (cheap, at record time):** a clause result that CONTRADICTS the review evidence in the
same decision is a HARD STOP (`ci_green_on_sha=pass` beside "4 legs red" in one payload).
⭐⭐⭐ **The BLOCK survived only because the session ignored the clause and read job logs directly — a
correct outcome is not evidence the instrument worked.** [[feedback_green_job_skipped_backend_zero_coverage]],
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

## D3 — a submodule gitlink hides the diff from every size- and path-based clause

The `+1/-1` `external/slang-rhi` gitlink (`1a976874`→`11eefdc6`) carries **7 commits · 22 files ·
+448/-160 = 608 lines**, yet `tier_eligible` scores it as **1 line / 1 file** (recorded "220 lines / 7
files within caps" — undercount ≈3.8× lines).

| D3 half | status |
|---|---|
| **size blindness** — every size heuristic (`max_total_lines`) scores a gitlink near zero | ✅ **FULLY GENERAL** |
| **path blindness** | ⚠️ **REPO-SPECIFIC here** — this submodule sits under `external/`, so `no_protected_paths` trips on `external/**` anyway; the general hazard is a submodule NOT under a protected prefix, whose inner paths are then invisible to path clauses entirely |

⭐⭐⭐ **`external/**` is the SOLE glob protecting the gitlink, and it does so as an artifact of layout, not
design** (counterfactual: drop it, keep the other 7 globs → the PR passes `no_protected_paths` entirely;
the outer gitlink is unprotected). It looks redundant beside `.github/**`/`**/*.yml`, so a re-tightening
pass that narrows it **silently opens the general case**. **A guard that works by coincidence is
indistinguishable from a designed one in the config, and reads as redundant — which is what gets it
deleted.** Two fixes for the owner: (a) annotate the incidental role (cheap — the missing information IS
the hazard), or (b) treat any gitlink modification as protected/ineligible (the real fix; widens what the
approver blocks ⇒ owner's call). ⭐ **Run the matcher, don't reason about the pattern:** `external/**` vs
`external/slang-rhi` (no trailing slash, a gitlink) → True only because `**`→`.*` after an optional `/`;
`.github/**` compiles root-anchored (`^\.github/.*$`) so it misses `external/slang-rhi/.github/...`, while
`**/*.yml` is unanchored and catches them. **A glob covers a path class only at the anchor it was written
for.**

## Measurement-validity consequence (the biggest one)

Precision statistics gathered under `v0-shadow-wide` describe a population the enforcing policy **will not
admit** — a PR shaped like #1090 (fork head + `external/**`) stops being eligible at enforcement yet
contributes to the `91%-of-82-abstains` figure the re-tightening decision rests on. Asks for whoever owns
re-tightening: record the policy version with every tally; mark policy-GRANTED passes distinctly from
substantively-VERIFIED ones (the `:184`/`:190` defect at population level); emit a shadow tally against the
bundle at record time. **How wide `v0-shadow-wide` is:** `require_ci_green` T→F · `allow_fork_head` F→T ·
`max_total_lines` 400→8000 · `max_files` 30→150 · `protected_paths` 8→1 · `trusted_associations` 3→7
(incl. `NONE`) — nearly every Step-1 gate relaxed at once, so "6/6 clauses pass" here does not mean what it
means under the bundle (which reverses `head_provenance`, `no_protected_paths`, and the meaning of
`ci_green_on_sha`).

## Durable lessons — the failure shape and its calibration

The chain took **3 rounds of retraction on whether D2 "fired"** (net: D2 LATENT, inert under the loaded
wide policy; a `pass` on substance would fire under the bundle). The reasoning trail is the durable part:

- ⭐⭐⭐ **Asking for the artifact beat arguing about it — 3 rounds of inference settled by 2 file reads.**
  **"I cannot verify this" is a routable request, not a dead end** — naming the two files I lacked is what
  produced them. And **"every policy on my disk says X" and "the bundled default says not-X" are BOTH true
  and NEITHER settles what a RUN did — only the run's loaded policy does.**
- ⭐⭐⭐ **A prediction confirmed by a reinterpreted observation is NOT confirmed** — that is the moment to
  re-derive, not promote. Self-criticism and peer-criticism both feel like skepticism while functioning as
  confirmation bias (the diligence slot — [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]).
  **An unnecessary retraction is a real error, not humility** — I amplified a wrong self-correction toward
  the harsher reading and destroyed a correct claim.
- ⭐⭐⭐ **Agreement isn't corroboration when the peer's source is me.** "Bug B exists in this file" +
  "symptom S occurred" ≠ "B caused S" — **the counterfactual is the test** (re-run with the defect removed;
  here removing the missing `json.loads` still yielded an empty `## Flags`, because the word "flag" was
  never on the scraped page). A genuine defect found while hunting is the easiest thing to over-credit.
  [[feedback_mechanism_must_predict_observed_coordinates]], [[feedback_unattributed_fact_reads_as_your_own]]
  (my relay is what raised the cost of the peer's error).
- **A null result does not name its own cause** — `grep -cF 'Flags'` = 0 was read as "mangled beyond
  recognition" when it was equally consistent with the marker never being on the page.
- ⭐⭐ **An ABSENCE REPORT INHERITS THE SCOPE OF THE SEARCH THAT PRODUCED IT, and that scope is the
  unstated part** (4 instances this chain: "not verifiable from my edge" — false, one `find /` away;
  "archived therefore scraped" — ~40% of runs time out before scraping; etc.). **State the search scope
  inside the claim.** [[feedback_published_negative_env_claims_need_rederivation]].
- ⭐⭐ **Reconcile components against `total_count` — it is free.** Three wrong build-leg counts (16/13/12,
  truth 12); my itemized 13 was self-detectably wrong (13+1+1+2=17≠16) and was *more persuasive because
  itemized*. **Reproduction by a DIFFERENT pattern is confirmation; the same pattern re-run is an echo.**
- **A one-line diff can be the largest change in a PR; size is not significance** (the `+1/-1` gitlink is
  the whole Vulkan/Metal import). **A whole-artifact byte-floor does not protect a per-section extraction**
  (the empty `## Flags` cleared `DEVIN_MIN_BYTES` because the analysis half is fat).
- **Two copies of a script = the fixed one may not be the executed one; find the invocation, never the
  better file** (the more-correct 331-line copy with the `json.loads` decode sits unused; the workflow
  points at the undecoded 187-line one). `-F`-first when a grep pattern has regex metachars
  ([[feedback_audit_grep_false_negatives_asymmetric]] — `grep -c 'Checks..s*.d'` returned 0 on a line just
  read by eye; `grep -cF 'Checks'` → 2).

## Related

[[project_slangpy_1090_metal_buffer_from_native_handle]] (the decision that surfaced these) ·
[[feedback_green_job_skipped_backend_zero_coverage]] (D2 family: a green *conclusion* isn't executed
coverage). **Blast radius on recorded decisions: none found** — the 3 Devin-sole WOULD_APPROVEs
(slang#12078, slang-torch#49, slang-rhi#806) were re-opened and each carried genuine per-PR analysis; the
peer's summary is the keeper: *"the guard never saved me — my own artifact-reading did, which is exactly
the wrong thing to rely on."*
