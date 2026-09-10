---
name: feedback_gh_paginate_401s_on_page2_use_explicit_pages
description: "During the OneCLI GitHub-connection outage, `gh api --paginate` deterministically 401s on page 2+ while explicit `?page=N` works. Piping to jq masks the exit code ⇒ silent truncation at 100 items = phantom-green. Use explicit pages + reconcile against total_count."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

**Main-reproduced 2026-08-03 14:2xZ on shader-slang/slang#12208 (126 check-runs), after slang-ci-babysitter reported it.**

## The defect

`gh api --paginate "repos/{o}/{r}/commits/{sha}/check-runs?per_page=100"` returns **page 1 (100 items) then 401s** with OneCLI `app_not_connected`. Explicit `?page=2` on the same URL returns the remaining **26**. Reproduced deterministically; babysitter measured 4/4 failures on `--paginate` vs 6/6 successes on explicit `?page=N`.

This is a facet of [[project_github_actions_graphql_401_outage]] — the same partial-degradation class that kills GraphQL while REST single-page stays healthy. It was already recorded on 08-01 that `--paginate` "returns page-1 then page-2 401s"; **this entry adds the phantom-green consequence and the exact invocation form that hides it.**

## ⚠️ Why it is dangerous: the exit code survives or dies depending on invocation form

| form | behaviour |
|---|---|
| `gh api --paginate … --jq '…'` | prints 100 items **+ the error JSON to stdout**, **exit 1** ✅ detectable |
| `gh api --paginate … 2>/dev/null \| jq -s '…'` | prints the truncated answer, **exit 0** ❌ **silent** — the pipeline reports *jq's* status; `gh`'s is discarded without `set -o pipefail` |

**So a sweep that pipes `gh` into `jq` gets a plausible under-count with a success exit code.** The babysitter's recipe used `jq '[.[]|.check_runs[]?]'`, and `[]?` additionally swallows the error document (it isn't an array of check_runs, so `?` drops it silently). Result: **capped at 100 checks, exit 0, no signal** — any red on page 2+ reads GREEN.

Concretely on #12208: page 1 holds 2 failures so it happened to look red anyway, but page 2 holds 0 — invert that distribution and the PR reads green while failing.

**Exposure this sweep: 6 of 54 non-draft open slang PRs had >100 checks (up to 135).** Babysitter re-swept all 6 with explicit pagination; **no hidden reds found ⇒ no prior wrong action**, but earlier sweeps under the old recipe had a real phantom-green window.

## The fix

1. **Never `--paginate` during this outage** — loop explicit `?page=N`.
2. **Reconcile against `total_count`**, which page 1 already gives you: `jq '.total_count'`. If collected ≠ `total_count`, fail loudly (babysitter added a `__COUNT_MISMATCH__` guard). This is the positive control — it makes truncation *impossible to read as success*.
3. If you must pipe, `set -o pipefail`, or use `gh`'s built-in `--jq` so the exit code isn't laundered.

## The generalizable rule

**A pagination helper that fails mid-walk is a non-discriminating signal: "fewer items than exist" and "that's all the items" look identical downstream.** Any collection whose size you don't independently reconcile can be silently truncated. Pair every paginated fetch with the server's own count.

Same family as the babysitter's own 200-byte-window bug (a truncated error-marker scan reads long error payloads as success) — see [[project_12116_dxc_prebuilt_zip_500_fetch_flake]] — and as `gh pr checks` phantom-greening on empty stdout ([[feedback_gh_auth_status_misleading]]).

## ❌ 16:2xZ — I MADE THIS EXACT ERROR TWO HOURS AFTER WRITING THIS FILE

At 14:2xZ I "verified" the live non-draft open-PR count as **54** using a **single** `?per_page=100` call and reported it to both the babysitter and the operator as the ground truth against which its payload was under-listing. **That number was itself truncated at page 1.** Paginating to exhaustion:

| page | open | non-draft |
|---|---|---|
| 1 | 100 | 55 |
| 2 | 100 | 20 |
| 3 | 33 | 1 |
| **total** | **233** | **76** |

**True count is 76, not 54.** The babysitter's 16:00Z figure was right and mine was wrong. I had just written the rule *"any unreconciled paginated collection can be silently truncated,"* then read a 100-item first page and treated it as complete — because 54 < 100 **looked** like a non-truncated answer. That's the trap: the *filtered* count came in under the page size, so nothing looked capped, while the *unfiltered* page was exactly 100 = the tell I should have checked.

**The rule, sharpened:** reconcile on the **raw page length**, not on your filtered subtotal. `length == per_page` means *there is another page* regardless of how small your filtered result is. For `pulls` there is no `total_count` field, so the terminator is a short page — keep going until `length < per_page`.

**And the meta-point, which is the ninth-instance lesson landing on me:** knowing the failure mode did not prevent it. The signal "my filtered count is comfortably under 100" cannot distinguish *complete* from *page-1-of-3*. Provenance was fine (real REST call, correct endpoint); only method fails here, and I skipped the method I had just documented.

**⭐ The sharpest framing of it is the babysitter's, and it names the specific condition under which this recurs:** *a cheap single call feels sufficient precisely when you are **checking someone else's figure** rather than producing your own — which is exactly when a wrong correction travels with extra authority.* Producing a number invites care; **auditing** one feels like it only needs a spot-check, and the corrector's number then inherits the credibility of the correction. So: **a verification performed to correct someone requires MORE rigour than the original claim, not less.** Same family as the earlier finding that a correction needs the same evidentiary standard as the claim it replaces — here it's the *measurement* rather than the *premise*. Both of today's cases had me generating a confident wrong artifact while in correcting posture.

## ✅ ROOT CAUSE OF THE PAYLOAD UNDERCOUNT — a hard clamp at 20, plus a separately-wrong `prCount` (babysitter, 3 consecutive confirmations)

**The list is HARD-CLAMPED at exactly 20 PRs.** Evidence: across three sweeps `prCount` drifted **29 → 28 → 27** while truth drifted **77 → 75 → 74** — a clean −1 per sweep, offset stable at ≈ −47 — and the emitted list stayed pinned at **exactly 20 every time**. Main-verified the truth side at 22:2xZ by exhaustive pagination with a three-way reconcile: **231 open = 74 non-draft + 157 draft** (74+157=231 ✓).

⇒ **Two independent defects, not one:**
1. **A clamp** on the emitted list (always 20).
2. **`prCount` computed over a real-but-wrong population** — it *tracks* truth's day-to-day delta, so it isn't random; it's counting a different set.

**⚠️ 08-04 00:0xZ — 6th consecutive confirmation, and the babysitter retracted its own "−1/sweep trend."** That drift (29→28→27) was **population churn, not a generator property** — it rose back to **29** today against 75 non-draft. The stable fact is only: **list pinned at exactly 20**, `prCount` tracking truth at a ≈−47 offset. ⭐Good example of *a trend fitted to three points is a hypothesis, not a property* — and of the same discipline as the constant-vs-measurement rule below: it correctly stopped claiming a mechanism its data couldn't support.

**⚠️ What the clamp was actually hiding: a stale-red BACKLOG, not fresh breakage.** Of the 29/75 heads carrying ≥1 failing check, **only 2 were pushed today** (#12186 self-healing priority gate, no action; #12080 3rd re-confirm of szihs's own-test CUDA red, not rerunnable). The other **27 are stale re-confirms — 16 of which had NEVER ONCE appeared in the babysitter's log**, oldest head 2026-01-30. Mostly non-CI policy gates (`label`, `check-formatting`, needs-rebase). ⇒ **the clamp's real cost was invisibility of a permanently-red backlog no sweep had ever enumerated**, not missed live regressions. Author/maintainer hygiene, explicitly **not** babysitter work — but 27 of 75 carrying stale red obscures genuine reds for any human eyeballing the PR list.

⭐**Earlier "what filter drops 9?" hypotheses were chasing an artifact of the clamp** — the gap is simply `prCount − 20`, and there is no 9-PR filter to find. **Lesson: when two numbers disagree, first ask whether one of them is a constant.** A constant masquerading as a measurement generates endless false hypotheses about the *difference*; the tell is that the discrepancy moves exactly in step with the other number.

Impact while unfixed: a sweep trusting the payload **asserts green over ~54 PRs it never opened**. Babysitter enumerates via REST regardless, so no coverage was lost — but this is now the third consecutive confirmation and it belongs to whoever owns the generator.

## ❌ 08-04 00:3xZ — SAME CLASS, DIFFERENT TOOL: `ncl sessions list` silently defaults to 200 rows

Investigating why slang#8306/#8785 sat unanswered, I ran `ncl sessions list | grep -E "8306|8785"` → **no match**, and concluded *"the triager was never dispatched — root cause is a missing dispatch on my side."* **Wrong.** `ncl sessions list` returns **exactly 200 rows** by default; with `--limit 2000` it returns 2000 and **both sessions appear immediately** (`sess-1784379813414-45qr7w` for #8306, `sess-1784379251124-qetp85` for #8785, created 07-18, `running`).

**The truth is the opposite of what I recorded:** the dispatch *did* happen, sessions exist, and each holds **in=1 / out=0** — the triager received the request and never produced a turn. I had briefly written a correction into my index asserting "the triager was never dispatched, it is healthy," which would have sent the next reader hunting a routing bug that doesn't exist while the real stall went unfixed.

**What makes this the same class as the `--paginate` and PR-count errors:** a truncated result set is indistinguishable from a complete one, and `grep` returning nothing on a capped list looks exactly like a genuine absence. Three instruments, one shape, all in one day:

| tool | silent cap | tell |
|---|---|---|
| `gh api` non-`--paginate` | 100/page | raw page length == `per_page` |
| `gh api --paginate` (during the 401) | dies at page 2 | error doc on stdout, exit code launderable |
| **`ncl sessions list`** | **200 rows** | **row count == exactly 200** |

⭐**Generalized rule: before concluding a record is ABSENT from any listing tool, verify the listing wasn't capped — count the rows and compare against the limit.** "Exactly 200" is as suspicious as "exactly 100." And note the aggravating factor: this absence-claim was *load-bearing for a root-cause attribution*, which is precisely where the earlier rule says relayed or cheap evidence needs the most scrutiny.

## Related coverage gap (separate, unresolved)

The babysitter's wake payload said `prCount: 28` but **listed 20**, while the live repo has **76** non-draft open PRs (Main-verified 16:2xZ by paginating to exhaustion — see the correction above; my earlier "54" was itself a truncated read). It swept all 76 by re-deriving from REST rather than trusting the handoff. **~56 PRs were outside the handed-off list** ⇒ a consumer trusting the payload is blind to roughly **74%** of open PRs, independent of the pagination bug. Recurring: `prCount` disagreed with its own list length at 08:00Z (26 vs 20), 14:00Z (28 vs 20), and 16:00Z (20 vs 76 actual). **Unverified root cause; flagged as a watch item, not a diagnosis** — plausibly the generator is itself doing an unreconciled single-page fetch, which would make this the same bug one layer up.

**Second payload defect, 16:00Z — `evicted=[]` was WRONG and missed a real eviction.** #11667 was evicted 14:49Z by a failed `merge_group` run; Main verified run `30818074297` = `conclusion=failure`, `event=merge_group`, head `c098c083`. The babysitter found it only via a REST `merge_group` cross-check, **because the payload's eviction field is GraphQL-derived and GraphQL has been 401 for ~52h.** So during this outage `evicted=[]` is not evidence of no evictions — it is an **absence produced by the outage itself**, the same non-discriminating shape as `gh pr checks` phantom-green. No requeue was needed (queue auto-requeued 14:52Z). ⇒ **cross-check `evicted` against REST `merge_group` every sweep until GraphQL recovers.**

## ⛔ DO NOT COMPRESS — the ONE-CALL denominator + the stable values (index line points here)
Appended 2026-08-03; the `MEMORY.md` hook cited `incomplete_results` and
`checked N of M` before this file held either (**forward reference** — see below).

✅ **One-call ground-truth denominator.** Unlike `/pulls`, `/issues`, `/commits`
(no `total_count`, terminate only on a short page), **`search/issues` HAS
`total_count`** — no pagination loop, nothing to reconcile:

```bash
gh api "search/issues?q=repo:OWNER/REPO+is:pr+is:open+draft:false&per_page=1" \
  --jq '.total_count, .incomplete_results'
```
- ⛔ **ABORT if `incomplete_results` is true** — search can return a partial answer
  that still parses cleanly, and a silently-partial denominator makes
  `checked N of M` *look* rigorous while M is wrong. (Guard contributed by
  slang-ci-babysitter; it was missing from my first version of this recipe.)
- ⚠️ **Search has its own rate bucket (`limit: 30`, `Resource: search`)** ⇒ use for the
  **denominator only, never the fan-out**. Also why "6000 ⇒ injected" misreads an
  injected search call — see [[project_critique_gate_pulls_pattern_builtin_floor]].
- ✅ It is a **different code path** from the enumeration it checks, which is what
  makes it a real cross-check rather than the same method run twice.

**Stable values — `shader-slang/slang`, measured 2026-08-03 ~18:5xZ (drift ≈ −1/hr,
so reconcile against these rather than silently replacing them):**

| population | count | method |
|---|---|---|
| open PRs, non-draft | **76** | paginated REST *and* `search draft:false` |
| open PRs, draft | **157** | `search draft:true` |
| open PRs, total | **233** | pages 100/55 · 100/20 · 33/1 (page 4 empty); unfiltered search |

**76 + 157 = 233 = paginated total** ⇒ three-way reconciliation pins the *partition*,
not just the parts (a draft-classification bug would surface instead of cancelling).
Generalizes: same query on `shader-slang/slangpy` → **8**.

⭐ **`checked N of M` is mandatory** — never report "no failures" without the
denominator. A sweep over 20 of 76 is **silent coverage loss**, not a cost problem.
⭐ **Keep the DATUM beside the rule:** this file once carried the raw-page *rule* while
the index dropped the *numbers*, so I re-derived 76/233 from scratch that the corpus
already held. Hooks compress; **stable values do not.**

## ⛔⭐⭐⭐ 2026-08-04 — I USED `--paginate` FOUR TIMES TODAY, having written this file YESTERDAY
Not a new defect: a **retrieval failure**, and the second tier hit it independently the same hour.
Today's uses: `pulls/12186/reviews --paginate` (twice), `pulls/12179/reviews --paginate`,
`issues/803/timeline --paginate`. All happened to be **under 100 items**, so all returned correct
answers — which is precisely why the habit survived: **an unsafe instrument that gets the right answer
teaches nothing.**

⭐⭐**The triager's independent instance is the one with a real cost:** it published `32 of 53` open
non-draft PRs idle ≥8d as a base rate **and shipped the REST probe as a reusable recipe.** Ground truth
by hand-pagination: **231 open / 74 non-draft / 50 idle = 67.6%.** Its numbers were **page 1 of 3**.
My independent `search/issues` figures (74, 50) were exact and matched hand-pagination on both.

⛔⛔**I CALLED THIS "STRICTLY WORSE" AND WAS WRONG — `gh` DOES report the failure (triager-corrected,
MINE-VERIFIED with `PIPESTATUS`).** One command settles it:
```
gh api … --paginate --jq '.[]|.number'            → exit=1          # gh alone fails HONESTLY
… | wc -l                                          → $?=0, PIPESTATUS=(1,0)
set -o pipefail                                    → $?=1           # recovers it
```
⇒ **The shell reports the LAST stage, so any `| wc -l` wrapper returns 0.** My "$?=0" was true of the
**pipeline**, never of `gh`. ⛔**Do not record that gh swallows its own error — it doesn't.**
⇒ ✅**The real defect is the WRAPPER, and the fix is `set -o pipefail` (or test `PIPESTATUS[0]`).**
⚠️**What IS real:** the `app_not_connected` JSON lands on **stdout**, glued to the last datum with no
trailing newline ⇒ it **contaminates `jq` and any strict parser**, though it does *not* inflate `wc -l`
(the triager's "101st row" was its own `2>&1` — an instrumentation artifact it had attributed to the tool).
⭐⭐**AUDIT RULE: when a mechanism blames a TOOL for something your own COMMAND did, suspect the command
first.** Both of us published a wrong mechanism riding a correct conclusion (`use total_count`) — and
because the conclusion was right, nothing ever pushed back on the *why*. **Same shape as a plausible
mechanism surviving on a true result.**

## ✅ THE RULE, KEYED WHERE IT WILL ACTUALLY BE RETRIEVED
**Counting ANYTHING repo-wide with `gh`?** ⇒ use **`search/issues` `total_count` at `per_page=1`** — it
is authoritative, needs no pagination, and matched hand-pagination exactly on both figures. Reserve
explicit `?page=N` loops for when you need the *items*, and reconcile the item count against
`total_count` before publishing it.
⛔**Never `--paginate | wc -l`. Never `--paginate` inside a pipeline whose exit code you don't test.**

⭐⭐**The qualifier both of us lacked: when the answer IS a total, a "control" on the number's MAGNITUDE
is useless.** 53 and 32 are non-zero and plausible; nothing about their size reveals a dropped page.
⇒ **the control must be an INDEPENDENT INSTRUMENT on the same question** (search vs REST), not a
sanity check on the value. Two instruments disagreeing was the only available detector — and it fired
only because the discrepancy was stated plainly instead of quietly reconciled toward one side.
⭐**Corollary: state a divergent number, don't defer to the other tier's.** I nearly wrote off the
53-vs-74 gap as "likely a scope difference."

⭐⭐**RETRIEVAL, NOT DISCOVERY — filed under the MECHANISM, not the artifact.** The triager had hit this
on #12320 the day before and filed it under that artifact, so a base-rate task never retrieved it; I
had this very file and still reached for `--paginate`. **The tell for both of us: writing a lesson you
have already written.** ⇒ key a lesson to the QUESTION that will summon it ("counting repo-wide",
"is this a total?"), never to the incident that produced it.
