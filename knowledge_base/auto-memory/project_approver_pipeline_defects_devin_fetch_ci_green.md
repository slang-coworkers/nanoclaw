---
name: project_approver_pipeline_defects_devin_fetch_ci_green
description: "Two approver-pipeline defects reported by slangpy-pr-approver on spy#1090 and MINE-VERIFIED in my own skill files: devin-fetch.sh Checks-N/M readiness match, and eval-clauses.py ci_green_on_sha reading only the combined status (blind to Actions check-runs)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# Approver-pipeline defects — `devin-fetch.sh` readiness + `ci_green_on_sha`

## 🔴🔴🔴 RETRACTED AGAIN (08-05, round 3 on ONE fact) — D2 did **NOT** fire. READ THIS FIRST.

**The "D2 FIRED FOR REAL" block below is WITHDRAWN by its author, and my own
self-correction inside it is ALSO withdrawn.** Net: **D2 remains LATENT.**

✅**BOTH ARTIFACTS NOW SECOND-SOURCED — the approver ATTACHED them and I read
them on my own disk** (08-05). No longer resting on its reading:
- `/workspace/inbox/a2a-1785937530020-iu64t1/1090-R2-loaded-APPROVAL_POLICY.json`
  — **`"require_ci_green": false` at line 9**, `policy_version v0-shadow-wide`.
  ⇒ clause **provably** takes the `:184` skip path.
- `/workspace/inbox/a2a-1785937540345-ncfmdq/1090-R2-clauses.json` — verbatim
  `{"name":"ci_green_on_sha","status":"pass","evidence":"policy does not require
  CI green"}`, `commit_sha bb870c1750cc…`, `mode live_late`, 6/6 pass, `fail: []`,
  `unevaluable: []`. **The record states its own cause.**
⭐**Asking for the artifact beat arguing about it — 3 rounds of inference settled
by 2 file reads.** ⭐**And "I cannot verify this" is a routable request, not a
dead end**: naming the two files I lacked is what produced them.

**What the recorded artifact says** (now MINE-VERIFIED per above): `clauses.json` carries
`{"name":"ci_green_on_sha","status":"pass","evidence":"policy does not require
CI green"}`, and the policy the run loaded
(`work/1090-bb870c1750cc/policy/APPROVAL_POLICY.json`, `v0-shadow-wide`) has
**`require_ci_green: false`**. ⇒ It short-circuited at `:184` and **never queried
the status API at all** — never read CodeRabbit's context, never consulted
combined status, **certified nothing about CI.** My CodeRabbit-vs-red-builds
observation is a true fact about the *commit* and was **never an input to the
decision**.

### ⭐⭐⭐ Why we disagreed for three rounds: DIFFERENT FILES, both read correctly

**MINE-VERIFIED on my disk:** both bundled policies (`slangpy-`, `slang-`) are
`v0-shadow` with **`require_ci_green: true`**. **Its runs load a MOUNTED policy**
(`v0-shadow-relaxed` → `v0-shadow-wide`, human-signed) with
**`require_ci_green: false`**. Neither reading was wrong; **they are different
artifacts.** ⇒ ⛔⭐⭐⭐**"every policy on my disk says X" and "the bundled default
says not-X" are BOTH true and NEITHER settles what a RUN did — only the run's
loaded policy does.** My "no bundled config takes the skip path" was a correct
statement about *bundles* that I wrongly let speak for the *run*. **Un-retracted,
as asked:** my original *"inert under `require_ci_green:false`"* framing was
right, and had the run's configuration behind it.

### ✅ What actually survives — and it is the defect I found independently

**The clause emits the identical `status: "pass"` on two unrelated grounds** —
`:184` (policy skip) and `:190` (substantive green) — MINE-VERIFIED at those
exact lines. Only the **`evidence` string** distinguishes them, so any consumer
keying on `status` cannot tell "we checked and CI is green" from "we never
checked." **That is what enabled three rounds of error, including the author's.**
**Fix: distinct statuses (`skipped` vs `pass`), not a prose difference.**

⚠️**D2 is UNTESTED IN PRODUCTION, NOT DISPROVEN.** It fires the moment
`require_ci_green: true`, and `:183` `policy.get(...,True)` **defaults True on an
absent key** ⇒ **a missing policy file activates it.** The tripwire ("a clause
contradicting the review evidence is a hard stop") stands on its own merits but
**would have caught nothing here — the clause made no claim to contradict.**

### 🔴⭐⭐⭐ D2's PRIORITY GOES **UP**, not down — the re-tightening is PRE-COMMITTED

**MINE-VERIFIED from the attached policy's own `_comment`:**
`require_ci_green: false` is **not an oversight** — it is a deliberate
**human-signed** measurement decision (**haaggarwal, 2026-08-04**), superseding
`v0-shadow-relaxed`, justified on **232 measured decisions** (53% were
`ABSTAIN_POLICY`; of the 82 abstains that later carried a decisive human verdict,
**91% were approved**), and it carries an explicit
**`MUST BE RE-TIGHTENED BEFORE ANY ENFORCEMENT`** condition naming
`.github/workflows/**` as a supply-chain surface and requiring the size cap be
set from measured precision-vs-PR-size.

⇒ ⭐⭐⭐**A defect that is inert only because of a temporary, explicitly-temporary
setting is NOT low priority — it is a SCHEDULED failure.** The substantive `:190`
path *will* be exercised, by written commitment. **SEQUENCING IS THE ACTIONABLE
OUTPUT:**
1. **`require_ci_green: true` must NOT land before the check-runs fix** — else
   enforcement *begins* with a CI gate that reads GitHub Actions as absent.
2. **`:183` defaulting True means a LOST MOUNT silently opts into the buggy path
   TODAY** — no policy change required to get bitten.
3. **The `skipped` vs `pass` fix is the PREREQUISITE for both** — a consumer
   keying on `status` cannot distinguish "checked, green" from "never checked",
   which is exactly the confusion that cost 3 rounds.

### 🔴⭐⭐⭐ "6/6 PASS" IS "6/6 UNDER WIDE, **4/6 UNDER THE BUNDLE**" — and D2 fires there

**MINE-VERIFIED by testing the recorded evidence against the bundle** (not just
diffing the two policies — that is the step that turns a diff into a finding):

| clause | wide | under the BUNDLE |
|---|---|---|
| `author_trust` | pass | **HOLDS** (`MEMBER` ∈ `[OWNER,MEMBER,COLLABORATOR]`) |
| `head_provenance` | pass | 🔴**REVERSES** — bundled `allow_fork_head:false`, head **IS** a fork (`fknfilewalker/slangpy`, verified `fork=True`) |
| `commit_match` | pass | **HOLDS** (policy-independent) |
| `ci_green_on_sha` | pass | 🔴**CHANGES MEANING** — bundled `true` ⇒ takes `:190`, a **real query** |
| `no_protected_paths` | pass | 🔴**REVERSES** — PR touches **`external/slang-rhi`**, matched by bundled `external/**` |
| `tier_eligible` | pass | **HOLDS** (220 ≤ 400 lines, 7 ≤ 30 files) |

⭐**The `external/**` match is MATCHER-EXECUTED, not reasoned:** I extracted
`glob_to_re` from `eval-clauses.py` and ran it — `external/**` vs
`external/slang-rhi` (**no trailing slash**, a submodule gitlink) → **True**,
because `**` → `.*` after an optional `/`. Glob semantics on a
directory-without-slash was the one place this could have gone either way; ⭐**run
the matcher, don't reason about the pattern.**

⚠️**And that path is not incidental — it is the submodule bump carrying the
ENTIRE Vulkan/Metal import implementation**, the most consequential file in the
diff (`+1/-1` in bytes, the whole feature in effect). ⭐**A one-line diff can be
the largest change in a PR; size is not significance.**

### 🔴🔴 D2 **DOES** FIRE ON THIS PR — under the bundle. Simulated, not predicted.

Under bundled `require_ci_green: true` the clause queries
`commits/bb870c1750cc/status` → **`success`, single context `CodeRabbit`** ⇒ emits
`pass "combined status=success"` — **while 4 build legs are RED** (linux gcc
Debug/Release, windows msvc Debug/Release). ⇒ **The "D2 is untested in
production" framing is now as tight as it can get short of a live run: the exact
commit, the exact clause, one policy flag away.** This is the counterfactual that
was missing all along — and it took *running* the bundle's path, not reasoning
about it.

### 🔴🔴🔴 D3 (NEW, 08-05) — A GITLINK HIDES THE DIFF FROM **EVERY** PATH-BASED AND SIZE-BASED CLAUSE

**The `+1/-1` `external/slang-rhi` gitlink is `1a976874` → `11eefdc6`.
MINE-VERIFIED what that one line actually carries:**

```
7 commits · 22 files · +448/-160 = 608 lines of churn
```
vs. `tier_eligible`'s recorded **"220 lines / 7 files within caps"** ⇒
**undercount ≈ 3.8× lines, 4.1× files.** Every size heuristic scores a submodule
bump at **1 line**.

### ⚠️ TWO CORRECTIONS TO MY OWN D3 FRAMING — the size half survives, the path half is narrower

**1. Peer's scoping correction (accepted).** Those workflows live in
**slang-rhi's** `.github/`, and GitHub Actions only executes workflows from the
**consuming repo's root**; slangpy has its own (`ci.yml`, `claude.yml`, …). **A
submodule's workflows do NOT run in the consumer's CI.** ⇒ ⛔**"6 new workflows
now run in slangpy CI" is WRONG — do not repeat it.** I reached for the strongest
phrasing and it over-claimed.

**2. My own measurement error, found by re-testing the peer's correction.** My
"9 hits" was computed on **submodule-root-relative** paths (`.github/workflows/…`).
In the slangpy tree they are **prefixed** (`external/slang-rhi/.github/…`).
Re-run with the correct prefixes: **22 hits, not 9** — but almost entirely via
`external/**`, i.e. *because they're under `external/`*, not because they're
workflows. ⭐⭐**A path-glob test is meaningless unless the paths are spelled as
the evaluator would see them — I tested strings from a compare API against globs
anchored to a different root.**

**3. And the finding that actually narrows D3:** the bundle's `external/**`
**already matches the OUTER gitlink entry `external/slang-rhi` itself**
(matcher-executed). ⇒ **under the bundle, `no_protected_paths` FAILS on this PR
anyway** — which is what the 4/6 table already said. So:

| D3 half | status |
|---|---|
| **size blindness** — `tier_eligible` scores the gitlink as **1 line** vs **608** real | ✅**FULLY GENERAL**, unaffected by both corrections |
| **path blindness** | ⚠️**REPO-SPECIFIC here** — this submodule happens to sit under a protected prefix, so the gate *does* trip. The general hazard is a **submodule NOT under a protected prefix**: then inner paths are invisible to path clauses entirely, including cases where the submodule's root *is* the CI surface |

⇒ **Rank D3 on the size/attention blindness, not on workflow execution** — the
peer's placement, and correct. **Blind by construction remains true**: clause
evaluation enumerates the **outer** commit, where the whole submodule is one
entry, so 608 lines of C++ compiled into slangpy are reviewed as 220.

### 🔴⭐⭐⭐ `external/**` IS PROTECTING INCIDENTALLY — do NOT "tidy" it at re-tightening

**MINE-VERIFIED counterfactual (drop `external/**` from the bundle, keep the other 7 globs):**
```
inner paths matched ONLY via external/**       : 13 of 22
inner paths still protected without it         :  9 of 22
outer gitlink 'external/slang-rhi' protected?  : FALSE
⇒ the PR would PASS no_protected_paths entirely
```
⇒ ⭐⭐⭐**`external/**` is the SOLE glob protecting the gitlink, and it does so as
an artifact of this repo's LAYOUT, not by design.** It looks redundant beside
`.github/**` / `**/*.yml`, so a re-tightening pass that narrows or removes it
**silently opens the general case** — and nothing else in the policy catches a
submodule bump. **Flag this in the same breath as D3.**
⭐⭐**A guard that works by coincidence is indistinguishable from a designed one in
the config file — and reads as REDUNDANT, which is what gets it deleted.**
⭐**Why the information loss IS the hazard:** `external/**` was near-certainly
written to protect **vendored third-party source**, not as a submodule-bump
backstop. It does that second job only because submodules happen to live under
`external/`, and **nothing in the policy file records it.** ⇒ two fixes for the
owner: **(a) annotate the incidental role** (cheap half — the missing information
is what creates the hazard), or **(b) treat any gitlink modification as
protected/ineligible**, which removes the dependence on layout coincidence and is
the real fix. **(b) widens what the approver blocks ⇒ owner's call, not ours.**

### ⚠️ ANCHOR SUB-FINDING — verified, with one membership correction against the peer

✅**The anchor mechanism is REAL and is the source of the redundancy illusion.**
MINE-VERIFIED: `.github/**` compiles to **`^\.github/.*$`** — root-anchored — so
it matches `.github/workflows/ci.yml` but **NOT**
`external/slang-rhi/.github/workflows/pr-checks-complete.yml`. ⇒ ⭐⭐⭐**A glob that
looks like it covers a path CLASS covers it only at the ANCHOR it was written
for.** That is precisely why pruning looks safe glob-by-glob.

⚠️**But the peer's attribution is wrong, and I checked rather than inheriting it.**
It said the 13 only-via-`external/**` paths *"include all six added
`.github/workflows/*.yml` files."* They do **not**: `**/*.yml` compiles to
`^.*[^/]*\.yml$` — **unanchored** — so it **does** catch all six at any depth.
Matcher-executed: each of the 6 is matched by `['**/*.yml', 'external/**']`.

**The actual 13 (MINE-VERIFIED) contain ZERO `.yml` files** — they are the *source*
files: 5 × `src/metal/*`, 5 × `tests/*`, `include/slang-rhi/capabilities.h`,
`docs/api.md`. ⇒ ⭐⭐**The corrected membership makes the point STRONGER, not
weaker: what `external/**` uniquely protects is the C++ implementation under
review — exactly the 608 lines D3 is about — while the workflow files were never
solely dependent on it.** Same lesson as before: fixing the input changed *which
mechanism was operative*, not just a number.

✅**What a fix requires (design note, not a patch):** resolve gitlink changes and
evaluate clauses over the **expanded** submodule diff — or treat any gitlink
modification as itself protected/ineligible, which is the cheap conservative
option. ⛔**Do not implement unilaterally; this widens what the approver blocks.**

⭐⭐**Generalization for the re-tightening owner:** *any* heuristic ranking
eligibility or reviewer attention by **lines changed** scores a submodule bump
near zero. `max_total_lines` is exactly such a heuristic. **#1090 is the worked
example: the smallest hunk in the diff (`+1/-1`) carries the entire
implementation under review AND 7 CI workflow files.**

### ⭐⭐⭐ The measurement-validity consequence (peer's finding, and the biggest one)

The widening is **pre-committed to reverse**, so those two passes are
**scheduled to reverse**. ⇒ **Precision statistics gathered under `wide` describe
a population the enforcing policy WILL NOT ADMIT.** The `_comment`'s
**91%-of-82-abstains** figure inherits that caveat — **and it is the number the
re-tightening decision will rest on.** A PR shaped exactly like #1090 (fork head
+ `external/**`) stops being eligible at enforcement, yet contributes to the
statistic arguing for enforcement.

✅**Concrete asks, recorded for whoever owns re-tightening:**
1. **Record the policy version with every tally** (already in `clauses.json`;
   must survive into the aggregate).
2. **Mark policy-GRANTED passes distinctly from substantively-VERIFIED ones** —
   the same defect as `:184`/`:190` both emitting bare `pass`, now at the
   population level rather than the row level.
3. **Emit a shadow tally against the bundle at record time**, so the gap is
   visible then instead of hand-reconstructed three rounds later.

⚠️**How wide `v0-shadow-wide` actually is** (MINE-VERIFIED, loaded vs the bundle
I hold): `require_ci_green` T→**F** · `allow_fork_head` F→**T** ·
`max_total_lines` 400→**8000** · `max_files` 30→**150** · `protected_paths`
8 globs→**1** (`**/slang-tag-version.h` only) · `trusted_associations` 3→**7**,
**including `NONE`**. Nearly every Step-1 gate is relaxed at once ⇒ **do not read
"6/6 clauses pass" under this policy as meaning what it means under the bundle.**

### ⭐⭐⭐ The failure shape, third instance in two days — and the worst

`json.loads` → `vkMapMemory` → this. All three: **a mechanism asserted without
testing it.** The first two needed real work to refute; **this one needed one
field of a JSON object already open.** The author's own account of what made it
feel safe is the durable part:
- **It confirmed a prediction just filed** ⇒ a `pass` beside red builds arrived
  looking **pre-endorsed**. ⭐⭐⭐**A PREDICTION CONFIRMED BY A REINTERPRETED
  OBSERVATION IS NOT CONFIRMED** — that is the moment to re-derive, not promote.
- **It was packaged as correcting a peer for being TOO GENEROUS** ⇒ the harsher
  reading *felt* like rigor. ⭐⭐⭐**Self-criticism and peer-criticism both feel
  like skepticism while functioning as confirmation bias** — the diligence slot
  again ([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]).
- ⭐⭐**And I amplified it by self-correcting toward the harsher reading** without
  checking whether my own retraction had evidence. **An unnecessary retraction is
  a real error, not humility** — it destroyed a correct claim.

## 🔴🔴 [WITHDRAWN] D2 FIRED FOR REAL — 08-05, spy#1090 @ `bb870c1750cc`

**MINE-VERIFIED by REST.** `GET commits/bb870c1750cc/status` →
**`state: success`, `total_count: 1`, and that single context is `CodeRabbit`** —
a *review bot*. On that same commit **4 build legs were RED** (linux gcc
Debug/Release, windows msvc Debug/Release). So `ci_green_on_sha` recorded
**`pass`** — "CI green" — **on a review bot's word, in the same decision whose
BLOCK evidence was those very build failures.**

⭐⭐⭐**MY EARLIER "inert under `require_ci_green:false`" ASSESSMENT WAS TOO
GENEROUS, and the approver corrected it against itself.** This run was
`v0-shadow-wide` and the clause reported `pass` **on substance**, not via the
policy skip. Worse than either of us first wrote:
- **MINE-VERIFIED: BOTH bundled policies set `require_ci_green: true`**
  (`slangpy-` and `slang-`, both `v0-shadow`) ⇒ **no bundled config takes the
  skip path at all**; the "inert" framing had no configuration behind it.
- ⭐⭐**The clause emits the SAME `pass` verdict on two utterly different
  grounds** (`:184` "policy does not require CI green" vs `:190` "combined
  status=success") ⇒ **a reader cannot tell a policy skip from a substantive
  green.** Cf. the class root
  [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] —
  a clause that reports `pass` and never `unevaluable` for "no build signal".

⭐⭐⭐**WHY THE DECISION SURVIVED — and why that is not reassurance:** the
session **ignored the clause** and read job logs directly via its own
`tmp/ci-logs.py`. A **broken clause did not stop a correct BLOCK because a
stronger primary source routed around it.** ⇒ **A correct outcome is not
evidence the instrument worked.** Had the verdict leaned on clauses, `pass`
would have certified green over 4 red builds.

✅**New tripwire (cheap, detectable at record time):** **a clause result that
CONTRADICTS the review evidence in the same decision is a HARD STOP.** Here
`ci_green_on_sha=pass` sat beside "4 legs red" in one payload.

⚠️**Attribution correction, mine to make:** the approver framed this as fixing
my roll-up's "CI settled 18/18 green". I did **not** claim green — my record and
my message both read *"18/18 (pagination OK), 11 success, **4 failure**, 0
in_progress"*, where "settled" meant *no longer `in_progress`*. **The substance
of its finding is new and correct and I accept it in full; the attribution is
off.** ⭐**Accept the finding, correct the aim — a correction that lands on the
wrong sentence still teaches the wrong lesson**
([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]).

## 🔴 CAUSAL RETRACTION 2026-08-03 (round 4) — READ BEFORE THE "SETTLED" BLOCK

**The mechanism below for D1 part 2 is WRONG. Observations hold; causation does
not.** Retracted by `slangpy-pr-approver` against itself, after I had already
restated it as verified **and relayed it upward**. My relay is what raised the
cost of its error — [[feedback_unattributed_fact_reads_as_your_own]].

- ❌**"missing `json.loads` made the split impossible and emptied `## Flags`"** —
  never counterfactual-tested. Approver decoded and re-ran the **exact** split:
  `json.loads` succeeds → **487 real lines** → split **still yields 1 part,
  Flags STILL EMPTY**, because `len(re.findall(r'flags?', text, re.I))` = **0**.
  **The word "flag" is nowhere on the scraped page, decoded or not.** A decode
  cannot conjure a marker that was never captured.
- ✅**Real cause is D1 part 1 ALONE, and it is the whole story for the empty
  section.** Page was complete but flag-less (`Devin's AI analysis` ×1,
  `Checks` ×1, no `Generating`/`in progress`). The done-poll was satisfied
  **solely** by the CI counter — both `\b\d+\s+Flags?\b` and `\bNo flags\b`
  absent — so the `:139-145` click found no matching button, **silently no-op'd
  under `|| true`**, and `:149` re-scraped the same flag-less page.
  **MINE-VERIFIED** on my copy: the click predicate is
  `/^(\d+\s+Flags?|No flags)$/i` and the whole `agent-browser eval` is
  terminated `|| true` — unmatched click is indistinguishable from success.
- ⚠️The missing decode is a **real but LATENT second bug**: it corrupts
  extraction on any run where the panel *did* render, and it's why `analysis`
  swallowed the body as one blob. **Two independent defects, collapsed into one
  causal story.** Fix priority **inverts**: require a flags-summary for `done`
  + make the no-op click LOUD **first**; the decode port is still needed,
  independently.
- ⚠️**Provenance correction to the shared record:** the "2 Flags + 2
  Informational" in the final `devin-flags.md` came from **separate later
  scrapes the subagent ran BY HAND** (`devin-page-flags.txt`,
  `devin-page-detail.txt`). **MINE-VERIFIED:** the 187-line script writes only
  `devin-error.txt`, `devin-flags.md`, `devin-page.txt`,
  `devin-screenshot.png` — neither hand file is among them. So the repair was
  **human-in-the-loop re-scraping, not a decode**.

### ⭐⭐⭐ The lessons this round earned

- ⭐⭐⭐**AGREEMENT ISN'T CORROBORATION WHEN THE PEER'S SOURCE IS ME.** I
  "confirmed" the mechanism by reading the file it named — but the file only
  showed the *defect exists*, never that it *caused the symptom*. My assent
  added a tier of apparent independence to a single unverified claim.
- ⭐⭐**"Bug B exists in this file" + "symptom S occurred" ≠ "B caused S".** A
  genuine defect found while hunting is the easiest thing to over-credit; the
  331-line copy having the decode made the story feel **too clean**.
  Cf. [[feedback_mechanism_must_predict_observed_coordinates]] — all legs
  verified ≠ explains THIS instance. **The counterfactual is the test: re-run
  with the defect removed and see if the symptom survives.** It did.
- ⭐⭐**The tell was in the approver's OWN evidence**: it reported
  `grep -cF 'Flags'` = 0 and read it as "mangled beyond recognition" — but
  *mangling was the assumption it arrived with*. **Zero is equally consistent
  with the marker never being on the page.** Same null-result trap as the other
  three instances, but inverted: here the zero was read as evidence *for* a
  defect rather than against one. **A null result does not name its own cause.**
- ⭐**A stated rule doesn't execute itself on your own confirmed findings** — the
  approver closed round 3 with "re-derive what looks like confirmation" and left
  exactly that finding un-re-derived.

## ✅ SETTLED 2026-08-03 — read this block first
### ⚠️ D1 part 2's CAUSAL claim in this block is RETRACTED — see the block above.

**Both defects CONFIRMED, both halves of D1 included.** My earlier "D1 part 2
CONTRADICTED" note below is **superseded**: I was reading the wrong file.

- **The approver ran the `nanoclaw` copy**, not the `slang` one:
  `~/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh` (**187**
  lines, `json.loads` = **0**). It identified this from the subagent
  transcript's `tool_use` **command**, not prompt text — both paths get
  *mentioned* in one session, which is the trap.
- **MINE-VERIFIED in that copy:** `:149`
  `agent-browser eval 'document.body.innerText' > devin-page.txt` — **no decode**
  — and `:156` `re.split(r'\n\s*\d+\s*Flags?\s*\n', text)`, a **real-newline**
  pattern against JSON-quoted single-line text ⇒ **the match is impossible**.
  Approver's measurements: `devin-page.txt` `wc -l` = **1**, first byte `"`.
  Result: `## Flags` came out **empty** while Devin had reported 2 Flags + 2
  Informational. `:104` also lacks the Bugs alternative entirely (older logic).
- **D1 part 1 COMPOUNDS part 2, and this is the load-bearing finding:**
  `Checks 12/17` was the **only** done-signal present (`grep -ciE 'flags?'` = 0),
  so the poll exited on a **CI progress counter having never seen a flags
  summary at all**. Two independent defects, same direction, and the second
  supplied the readiness the first then mangled.
- **Both guards passed**: no `Generating…`, and total size cleared
  `DEVIN_MIN_BYTES` **because the analysis half is fat** — the byte-floor guard
  cannot see a section-level empty. ⭐**A whole-artifact size check does not
  protect a per-section extraction.**
- **Irony worth keeping:** the more-correct **331**-line `slang` copy (which has
  the decode) sits **unused**, and the workflow text points at the undecoded one.
  ⭐**Two copies of a script = the fixed one may not be the executed one; find
  the invocation, never the better file.**

**D2, sharper than first reported — MINE-VERIFIED by REST at the head:**
combined status at `5c384a20b11b` is `state: success` from **exactly 2
contexts: `license/cla` and `CodeRabbit`** (`total_count: 2`) — a CLA bot and a
review bot, **no build at all**. Meanwhile `commits/{sha}/check-runs` returns
**16** runs, all invisible to the clause. So `ci_green_on_sha` would have read
**green from two bots while structurally blind to every build**.

### ⭐⭐ The count episode — THREE wrong numbers, ground truth = **12**

Re-derived by predicate, not by eye
(`[.check_runs[]|select(.name|startswith("build ("))]|length`):

| claim | value | status |
|---|---|---|
| approver's first report | 16 | ✗ conflated *all* check-runs with *build* check-runs |
| **my correction** | **13** | ✗ **self-detectably wrong: 13+1+1+2 = 17 ≠ stated total 16** |
| **ground truth** | **12** | ✅ 12 `build (...)` + 4 non-build = 16 = `total_count` ✓ |

Non-build remainder: `pre-commit` (success), `add-to-project` (success),
`Claude Code Assistant` ×2 (**skipped**).

⭐⭐**RECONCILE COMPONENTS AGAINST `total_count` — it is free and neither of us
did it.** My 13 came with a breakdown, which is what made it *checkable* and
also what made it *persuasive*; the approver briefly accepted it as
more-credible-than-its-own **because** it was itemized.
⭐⭐⭐**A plausible peer-supplied number is as dismissible-looking as a null
grep — the artifact that LOOKS like confirmation is the one to re-derive.**
Third instance in one session of the same shape (case-sensitive null grep ·
regex-metachar null grep · itemized peer number): **the reassuring signal was
produced by the very defect it would have dismissed.**

⚠️**Pagination caveat on this endpoint:** `check-runs` pages at 30, and
`total_count > len(check_runs)` silently short-counts. Verified here:
`total_count` 16 == `len` 16, so this reading is complete. Always print both.

### ⭐ The macOS detail cuts *FOR* G1, not against it

Both macOS legs are present and **`success`**:
`build (macos, aarch64, clang, Release, 3.10)` and `... Debug, 3.10)`. They
**built**; neither **executed** a Metal GPU test, because the job lands on
`macos-latest` (paravirtual). **A green macOS check-run is therefore the
affirmative signature of "builds but does not execute."** The trap: a reviewer
skimming for a *red or skipped* macOS entry finds none and concludes coverage
exists. ⛔The 2 `skipped` runs are `Claude Code Assistant` (the review bot) —
**not** a skipped build; never cite them as G1 evidence.
Caveat inherited verbatim by both tiers: **neither of us opened an rhi CI log.**

Also confirmed: `eval-clauses.py:183` is `policy.get("require_ci_green", True)`
⇒ **defaults True when the key is absent**, so unmounted-policy runs inherit the
wrong-answer path. The fix needs an `unevaluable` branch for "no build signal" —
a **policy call, not a patch**.

⚠️ Note the 2 `skipped` check-runs are *`Claude Code Assistant`*, i.e. the review
bot — **not** a skipped build. Do not cite them as G1 evidence; G1 rests on
macOS CI building-but-not-executing, which is a separate observation.

**Neither of us applied a fix.** Fixes named only. Loosening a CI predicate or a
safety regex unilaterally is out of bounds.

---

*Original 08-03 entry below — retained for the reasoning trail. Its D1-part-2
"CONTRADICTED" verdict is WRONG (wrong artifact); its refusal to call that a
refutation is what left room for the correct answer.*

Reported by `slangpy-pr-approver` while deciding shader-slang/slangpy#1090
(2026-08-03). **I verified both in my own `/home/node/.claude/skills/` copies** —
these are not relayed claims. Both fail *toward clean/green*, which is the
dangerous direction.

## D1 — `devin-fetch.sh` readiness can match a CI-checks counter

`/home/node/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh:109`
(`DONE_EXPR`, `summary`) accepts, as a done-signal, **any** of:
`\d+ Bugs?` · `\d+ Flags?` · `No (bugs|flags)` · `All checks passed` ·
`checks? failed` · **`Checks\s*\d+\s*/\s*\d+`**.

The last alternative matches a **CI-checks counter** (`Checks 12/17`) — a string
about *GitHub CI progress*, not about Devin's analysis being complete. Paired
with `heading && summary`, a page showing the analysis heading plus a CI counter
reads as done. **CONFIRMED PRESENT** at `:109`; the comment at `:95` documents
the counter as an intended signal, so this is by-design-but-wrong, not a typo.

**Mitigations that already exist** (why this is a latent hazard, not a live
false-clean generator): a `Generating…` still-streaming veto at `:105`, a
two-consecutive-poll stability requirement, a post-scrape `Generating` guard,
and a `DEVIN_MIN_BYTES` 200-byte floor — each exits 3 (best-effort skip) rather
than exit-0 clean. So the approver's "exit 0 with an empty flags section" is
**plausible but I did NOT reproduce it**; I confirmed the matcher, not the
observed exit-0 path.

⚠️ **The approver's second half — "extractor splits on newlines against
JSON-quoted text" — I could NOT confirm; the slang copy CONTRADICTS it.**
`:215-224` pipes `document.body.innerText` through
`python3 -c "... json.loads(raw) ..."` **before** the header split, with a
comment naming exactly that failure mode. `grep -cF 'json.loads(raw)'` = **2**
in the slang copy. So in the copy I hold, the JSON-decode is present.
- ⚠️ **`nanoclaw-pr-review-runner/scripts/devin-fetch.sh` has json.loads = 0** —
  the two copies **differ**. If the approver ran a *different* copy (mounted in
  its own container, not this one), its report could be true of that copy.
  **I did not establish which file the approver executed** — its container has
  its own filesystem. Do not treat my `slang-*` reading as a refutation of its
  claim; the artifacts may not be the same artifact.

## D2 — `ci_green_on_sha` is blind to Actions check-runs — CONFIRMED

`slangpy-pr-approver/scripts/eval-clauses.py:181-197` (and the `slang-` twin)
evaluates CI green from **`repos/{repo}/commits/{sha}/status`** only — the
legacy *combined status* API. `grep -cF 'check-runs'` = **0** in **both**
approvers' `eval-clauses.py`. GitHub Actions jobs are **check-runs**, not
commit statuses, so a repo whose CI is pure Actions can report combined
`state: success` (or `none`) while builds are still `in_progress`.

**Severity is policy-dependent, and the bundled default is the WRONG side:**
- `slangpy-pr-approver/scripts/APPROVAL_POLICY.json` (bundled) has
  **`"require_ci_green": true`** and `policy_version: "v0-shadow"`.
- The #1090 decision ran `v0-shadow-relaxed` with `require_ci_green:false`,
  which takes the `:183` early-out (`"policy does not require CI green"`) and
  never touches the defect. So the defect was **inert for this decision** —
  the approver said as much, and it's right: the *conservative bundled default*
  is the configuration that gets the wrong answer. A mounted
  `policy/APPROVAL_POLICY.json` overrides the bundle.

⚠️ Note the mismatch: the file I hold says `v0-shadow`; the approver reported
running `v0-shadow-relaxed`. Different artifact ⇒ **it is running a mounted
policy I cannot see.** Don't quote my bundled values as its effective config.

## Not fixed by me

I changed nothing. Both live in `/home/node/.claude/skills/` (my copies) **and**
in whatever the approver containers mount — a fix has to land at the source the
containers actually read, or it's a fix to a copy nobody executes
(cf. [[feedback_shared_index_is_generated_use_shared_root]]).
⛔ Do not loosen or "fix" a safety regex unilaterally
([[project_critique_gate_pulls_pattern_builtin_floor]]).

## Related

- [[project_slangpy_1090_metal_buffer_from_native_handle]] — the decision that surfaced these
- [[feedback_green_job_skipped_backend_zero_coverage]] — D2 is the same family: a green *conclusion* isn't executed coverage
- [[feedback_mechanism_must_predict_observed_coordinates]] — why "matcher present" ≠ "explains the observed exit-0"
- [[feedback_audit_grep_false_negatives_asymmetric]] — I hit this mid-session: `grep -c 'Checks..s\*.d'` returned **0** on a line I had *just read with my eyes*; `grep -cF 'Checks'` → 2. Regex metachars in the pattern. The `-F`-first rule earned its keep again.
