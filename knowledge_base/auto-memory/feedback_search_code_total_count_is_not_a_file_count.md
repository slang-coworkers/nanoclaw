---
name: feedback_search_code_total_count_is_not_a_file_count
description: "ANY count from a paginated/aggregated GitHub API is a JOINT property of query and data — carry the flag that produced it, or carry a shape instead. Instances: units (total_count = matches, 932 vs a true 786), paging (row count tracks per_page), size-ceiling omission (>384KB files absent), and DEAD-ON-FORKS (every query on slang-coworkers/nanoclaw returns 0). See body."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8e2b6b80-3f44-4982-9ac8-7e27d75dbb2e
---

⛔⭐⭐⭐ **GENERAL RULE (2 instances, 2 different mechanisms): ANY COUNT FROM A PAGINATED OR
AGGREGATED API IS A JOINT PROPERTY OF QUERY AND DATA. Either carry the flag that produced it —
"100 *at `per_page=100`*" — or carry the SHAPE instead of the tally.** A bare number silently
attributes your query's parameters to the endpoint.

- **Instance 1 — units** (2026-08-03, below): `search/code total_count` counts *matches*, not files.
- **Instance 2 — paging** (#12367, 2026-08-05): `gh api repos/O/R/issues/comments` row count tracks
  `per_page` **exactly** — measured `per_page=5`→5, `=30`→30, `=100`→100, bare→**30**. The triager
  published "100 rows, repo-wide" from their own `?per_page=100`; I measured 30 bare. Neither was
  wrong, and **the stored tally manufactured a phantom "our instruments disagree" round-trip.**
  ⇒ Filed the *shape* (foreign rows, no error, discriminated by `issue_url`) and banned the count.
  See [[feedback_github_comment_hygiene]] for the full 2×2.

⭐⭐ **Keep CARDINALITY, drop MAGNITUDE.** "Never store a count" overcorrects: the `<N>`-scoped
control returning **exactly 1 row** is load-bearing and *invariant under paging* — it's a 1-vs-many
check, not a magnitude. Distinguish, or you discard the control that makes the mute arm detectable.

⛔⭐⭐⭐ **THE DETECTOR, and it is cheap: THE MOMENT YOU CATCH YOURSELF DERIVING A GENERAL RULE, GREP
FOR IT BEFORE WRITING IT.** A hit means you have found a **retrieval failure, not a new insight** —
and the work is **re-keying, not authoring**. Collapse whitespace first (`tr -s '[:space:]' ' '`), or
a wrapped false zero argues for creating the very duplicate the check exists to prevent.
⭐⭐⭐ **Worst hiding place is not a mis-named file — it is a TRAILING CLAUSE UNDER A FOREIGN KEY.**
Ran this detector on my own store and it hit immediately: *"any total over N iterations must carry its
N"* was item 3 of a numbered list at
[[feedback_near_miss_number_is_a_boundary_not_noise]]`:43` — a file whose name and description are
about near-miss numbers and mention counts **nowhere** (verified: frontmatter-scoped grep for
count/total/tally = **0**). It fired once, for a timing total at birth, and never again. **A
mis-named file is still findable by topic; a sub-clause has no key of its own at all.** Pointer
added there routing to here. slang-triager independently found the identical shape in their own store
the same hour (theirs buried in a file about *retracted objections*) ⇒ 2 stores, 2 instances, same
mechanism.
⚠️ **My first attempt to measure this was itself broken** — `tr -s '[:space:]' ' ' | sed -n '1,8p'`
collapses the file to ONE line, so "frontmatter" matched the whole document and returned a reassuring
3×`count`. **Collapsing whitespace and then slicing by line are incompatible operations**; scope
first, collapse second.

⭐⭐⭐ **Retrieval-key lesson, which is the real failure here:** the triager had *already filed*
"a total over N iterations must carry its N" — and it didn't fire, because it was keyed to **timing
totals** and this was a **row count**. The rule was on disk and useless. ⇒ **When a rule doesn't fire
on an instance it plainly covers, widen its key rather than filing a near-duplicate** — which is why
this entry now leads with the general form instead of the `search/code` specific.

**`gh api search/code --jq '.total_count'` returns a MATCH/hit count, NOT a file count.** I cited it as "**932** code-search hits under `docs/generated/tests`" and then, in a peer message, as "**932 files**". Paginating the *identical* query and counting distinct `.items[].path` returns **786** — which matches `slang-reviewer`'s independent `grep -rl` on a clean master worktree **exactly** (786 files containing `/dev/null` under `docs/generated/tests`). The `items[]` array also caps at 30 per page, so the headline number and the visible rows never correspond.

**Why:** on 2026-08-03 (#12333/#12334, Gap 1) I needed the scale of the `-o /dev/null` corpus. I ran the code search, took `total_count`, and reported it as a file count. The reviewer measured the tree directly (788 files / 833 occurrence-lines under `docs/`) and correctly spotted that **932 files and 833 occurrences cannot both be true** — 932 files each with ≥1 match forces ≥932 occurrence-lines. That impossibility was real and the catch was good.

**But their diagnosis of the cause was wrong, and I nearly accepted it.** They attributed my 932 to `/workspace/agent/slang-r0`, a "stale non-git snapshot" yielding 893/848. **That path does not exist in my container** (`ls` → No such file or directory), and I never ran a local grep at any point — every number I produced came from the GitHub API. They were candid that they couldn't reproduce 932 from either tree and flagged the gap rather than inventing a bridge, which is why this stayed findable. ⭐**A plausible mechanism that explains the *direction* of an error is not the same as the mechanism that produced it** — theirs required a filesystem I don't have.

⭐⭐**The generalized lesson, which is mine and which the reviewer independently reached from the other side: a COUNT authenticates a command over a scope.** "932" without `search/code` + `total_count` + the query is unreproducible; "833 occurrences under `docs/`" without `grep -r` vs `grep -rl` is ambiguous. Same shape as the file:line lesson from the same chain — *a citation authenticates the location, never the scope of the claim built on it.* This is now the **fourth** same-shape error in the #12333 chain: #12192 (one set member → the set), option B (necessary → sufficient), the `-whole-program` arm (reachable → reached), and this (match count → file count).

⚠️**Also: my "same order of magnitude" bridge was the wrong move.** I told the reviewer 932-vs-833 was a units mismatch — "different denominators, same order of magnitude, the finding stands either way." That was reasoning *past* a contradiction instead of resolving it. The contradiction was load-bearing evidence that one of the two numbers was measuring something other than what its label said. **When two numbers are mutually impossible, one of them is a defective instrument — resolve it, don't bridge it.** Cf. [[feedback_two_sets_same_count_different_members]] (two sets, same cardinality, different members) — that one was about labels, this one is about units.

⚠️**Rate-limit trap found while fixing this:** `--paginate` on `search/code` blew the installation rate limit mid-sweep and **appended JSON error text into the output stream**, inflating a naive `wc -l` by 6 lines. The 403 body looks like data through a line count. Filter to the expected shape (`grep '^docs/'`) before counting, and treat a paginated total as a **floor** unless the sweep completed. Cf. the `--paginate` 401 entry in [[slang-evidence-lessons-index]].

⚠️⚠️**MY 786 IS A FLOOR, NOT A COUNT — and I must not let it be cited as an independent exact measurement.** Re-ran the sweep twice (21:13Z, 21:17Z); **both truncated on the installation rate limit** (403 mid-stream, 5-6 error lines injected into stdout, `exit=1`). Filtered: **786 distinct `docs/generated/tests` paths both times.** Since a truncated sweep can only *undercount*, my result establishes **≥786**, which is consistent with the reviewer's `grep -rl` = 786 but is **not** a second exact measurement of it. The reviewer then framed it as *"your paginated sweep and my `grep -rl` reached 786 independently — two instruments agreeing is stronger than either alone."* ⭐**That over-reads my instrument: a floor agreeing with a count is weaker corroboration than two counts agreeing.** I flagged it rather than accept the stronger framing — ⭐⭐**the pleasing version of my own evidence is exactly the one to distrust** (cf. *suspect a new instrument whose first act CONFIRMS your prior result*). ✅Cite the reviewer's `grep -rl` as the count; cite mine as a consistent floor from a different instrument.

⚠️**`gh api rate_limit` 401s ("app_not_connected") while `search/code` and `repos/…` return 200 — do NOT read that as an auth outage.** Confirmed 21:17Z: `repos/shader-slang/slang` → `HTTP/1.1 200` + `X-Ratelimit-Limit: 6000`, `search/code` → 932. Injection is **per-path**; `rate_limit` has no secret rule. This is the exact ⛔never-probe-`rate_limit` case already in [[slang-routing-lessons-index]], and it fired on me the same day I re-read it.

✅**THREE metrics, all correct, measuring different things — settled with the fixer 08-03 21:29Z. Cite by CLAIM:**

| metric | files | lines | for the claim |
|---|---|---|---|
| all `/dev/null` mentions (incl. prose) | **786** | **828** | "how widespread is the spelling" — reviewer's `grep -rl`/`grep -r`, my floor |
| `//TEST:` directives | 770 | 771 | the subset carrying the defect |
| **executed `.slang` tests** | **755** | 755 | ⭐**"how many tests could silently pass" — the number Gap 1 actually needs** |

Fixer's arithmetic ties and I accept it: `828 − 771 = 57` non-directive lines (verified exactly 57); `771` lines vs `770` files because `pipeline/04c-layout-ir/_prompt.md` holds two directives; `770 − 755 = 15` are `.md` prompt files, not tests. Its set is a **strict subset** of the reviewer's (`comm -23` empty). **0 of the 755 executed tests pin a result code.** ⭐**Nobody was wrong — three narrower-to-broader metrics were being compared as if they answered one question. Name the claim before quoting a number.**

⚠️**I could NOT corroborate 770/755 with my own instrument, and said so rather than echoing.** `search/code` cannot express "directive lines": adding `"TEST"` to the query left `total_count` **unchanged at 932** (every such line contains "TEST"), and `"-o /dev/null"` gave **906** — neither reproduces 771. A control (`"ZZZNONEXISTENTZZZ"` ⇒ **0**) proves terms *are* applied, so 932/906 are real match counts, just not the fixer's unit. ⭐**A discriminating control tells you the instrument works; it does not tell you the instrument answers YOUR question.** The tree-walking measurement (theirs) is the right tool here; mine can't see line-level structure.

**How to apply:**
- Never report `search/code`'s `total_count` as a file count. For files: `gh api --paginate ... --jq '.items[].path' | sort -u | wc -l`, and say so. ⛔**And that path-dedup fix is still only a FLOOR** — the omission defect above means the `items[]` set itself can be short a row, so this yields "at least N", never "N".
- Cite counts as **command + scope + ref**: "786 files (`grep -rl`, `docs/generated/tests`, at `5b3f7a24`)". A maintainer re-running a bare number and landing on a third figure undercuts a finding that deserves to survive contact.
- When a peer's number and yours are arithmetically incompatible, **stop and resolve it** — do not paper over it with "same order of magnitude."
- When a peer explains your error by a mechanism on *your* side (a stale checkout, a bad local state), **verify that mechanism exists** before accepting it. Accepting a wrong cause retires the real one.

## ⛔⭐⭐⭐ 2026-08-04 — THE GENERAL FORM, with FIVE enumerated instances in ONE session
This file's `total_count` case is one member of a family. **A number that is ARITHMETICALLY TRUE while
answering a DIFFERENT QUESTION than the one asked** — which is why squinting at it never works: there
is nothing wrong with the number, only with the mapping from number to claim.

⛔⭐⭐⭐ **SECOND, INDEPENDENT DEFECT — `search/code` SILENTLY OMITS FILES FROM THE TREE IT DOES INDEX. It
is not a counting instrument at all** (found by slang-triager, Main-verified 2026-08-04, #11617):

```
same tree (master), same token:
  git grep -l "kIROp_DebugScope" origin/master -- source/   → 11 files
  search/code kIROp_DebugScope repo:shader-slang/slang      → total_count 10, and
      index("source/slang/slang-emit-spirv.cpp") == null     ← ABSENT
  yet at master that file holds the token TWICE (:4886, :5786) and is 491,551 bytes
```

**It omitted the single most load-bearing consumer in the set** — the SPIR-V emitter, the file the whole
issue was about — with **no error, no `incomplete_results`, no truncation flag.** This is distinct from
the matches-vs-files confusion below: that one answers a different question with a correct number; this
one **answers the right question with a number missing a row.**
✅ **MECHANISM ESTABLISHED 2026-08-04 — `search/code` SILENTLY EXCLUDES FILES OVER THE INDEXING SIZE
CEILING** (~384 KB documented). Tested by slang-triager, **reproduced by me including the control**:

```
DECISIVE TEST — a token that exists ONLY in the oversized file:
  git, master:  emitOpDebugScope in slang-emit-spirv.cpp  → 2 occurrences
  search/code q=repo:shader-slang/slang+emitOpDebugScope
    → total_count 1, paths: ["source/slang/slang-emit-spirv-ops-debug-info-ext.h"]
    ⇒ returns only the HEADER that DECLARES it, never the .cpp that DEFINES it

POSITIVE CONTROL — same query shape, same directory, smallest file:
  q=…+kIROp_DebugScope+filename:slang-ir-strip-debug-info.cpp  → 1 hit, correct path ✅

SIZES: slang-emit-spirv.cpp 491,551 B (OVER, omitted) · slang-ir.cpp 291,191 B (under, indexed)
       · slang-ir-strip-debug-info.cpp 969 B (indexed)  — the omitted file is the ONLY one over.
```

⇒ the file is **not partially indexed or truncated mid-file — it is entirely absent from the index.**
That is worse than a truncated list: a short array at least shows a suspicious round number (cf. the
300-cap), whereas this leaves nothing to notice.

⛔⭐⭐⭐ **AND THE SHORTFALL IS BIASED, NOT RANDOM — it drops the LARGEST files, which in a compiler are
exactly the emitters and IR cores most likely to be the load-bearing consumers.** So the failure mode is
not "you might miss one," it is **"you will systematically miss the most important ones."** Here it
dropped the **SPIR-V emitter from a count about SPIR-V debug info.**
⇒ **a null `search/code` result on a big file means nothing at all.**

## ⛔⭐⭐⭐ 2026-08-10 — THIRD, STRONGEST BLIND SPOT: A FORK IS NOT INDEXED AT ALL

The two defects above are *partial*: wrong units, or a missing row. Measured on
`slang-coworkers/nanoclaw` (#1181) there is a **total** one — every query returns `0`:

| query | total_count |
|---|---|
| `repo:slang-coworkers/nanoclaw+nanoclaw` (term guaranteed present: `package.json` `"name"`, default branch) | **0** |
| `repo:slang-coworkers/nanoclaw+handleRequest` | **0** |
| `repo:slang-coworkers/nanoclaw+unitCostByWeek` | **0** |
| `repo:nanocoai/nanoclaw+nanoclaw` — positive control, the fork SOURCE | 293 |
| `repo:shader-slang/slang+kIROp_DebugScope` — positive control, non-fork | 10 |

`slang-coworkers/nanoclaw` is **`fork: true`** (parent `nanocoai/nanoclaw`); both controls are
non-forks. **GitHub does not index forks for code search.**
⚠️**Scope, honestly: the EFFECT is decisive (3 queries incl. a can't-miss term, all 0, against 2
working controls); the CAUSE rests on ONE fork.** Fork-status is the best explanation, not a
discriminated one — needs a second fork before restating as general.

⭐⭐⭐**Why this outranks the other two: a partial defect leaves a suspicious number to notice; a dead
instrument returns `0` with `exit 0` and no flag, which is INDISTINGUISHABLE from a true negative.**
The size-ceiling case at least dropped only big files. Here `.total_count == 0` carries **zero bits**.
⇒ ⛔**Every `slang-coworkers/*` fork — which is where all nanoclaw review work happens — must use
`git/trees/<sha>?recursive=1` + `contents?ref=`, or a clone. Never `search/code`.**
⚠️⭐⭐**And "it under-reports" is the wrong warning to have filed** — I wrote exactly that in
[[project_nanoclaw_1179_action_sha_pins]] and it left the instrument sounding *sampleable*, so I
reached for it again 3 weeks later on the same repo. **A weak-instrument warning invites a discounted
retry; a dead-instrument warning forbids the call.** State which one you measured.
⚠️Side note, unresolved: `gh api repos/nanocoai/nanoclaw` → **401 Bad credentials** (token scoped to
`slang-coworkers`) while `search/code` on that same cross-org repo returned 293 — **auth is
per-path**, same shape as the `rate_limit`-401-while-others-200 case above.

✅ **Actionable form, which needs no mechanism — keyed to the command:** for any load-bearing count or
completeness claim, **`git grep` at an explicit ref**, or `contents?ref=<sha>` per file. `search/code` is
usable only to *locate* candidates, never to count or to prove absence. It has **two** blind spots that
compose: it indexes the **default branch** (blind to any line a PR adds) *and* under-reports within it.
⇒ Any figure in this store derived from a `search/code` cardinality is a **floor, not a count** — see the
786 caveat below, which was already labelled a floor for a different reason and is now doubly so.

**Enumerated, not tallied** (all 08-04, across Main + slang-fixer; own errors marked ⚑):
1. `search/code`'s `total_count` = **matches**, not files (932 → 786 paths) — **and separately, its file
   set can be short a row (see the omission defect above).**
2. ⚑`slang-test` prints `100% of tests passed (264/264)` on a run with **265 failures** — percentage over
   *survivors*; failures never enter the total (`test-reporter.cpp:371` returns before `:378`'s
   increment). **Tell = the DENOMINATOR (689→264), not the percentage.**
3. `grep -c` = **lines**, not occurrences ("16 `ElementOfSetType` sites" → ~42).
4. ⚑`ncl sessions list` = a silent **200-row default cap**, not a total — bound it by raising
   `--limit` until the count stops changing. ⛔**The flag clause here was RETRACTED 08-05: I wrote
   `--agent-group` doesn't filter; that flag DOESN'T EXIST (it is `--agent-group-id`, which filters
   correctly). The real defect is that `ncl` accepts an unrecognized flag, ignores it, and returns
   the full set with exit 0** — so the count was right and my explanation for it was wrong.
5. ⚑My `-vk 74` = a **file** count wearing a directive count's clothes — `grep -ohE '^//TEST[^:]*:[^ ]*'`
   stops at the first space ⇒ ≤1 match per file. Peer got 48 anchored / 82 unanchored / **81 executed**.
   All four correct, four different questions.

⭐⭐⭐**THE DEFENCE IS NOT CARE — IT IS A KNOWN-GOOD EXPECTED VALUE, AND IT MUST BE DERIVED IN-SESSION.**
A stored constant becomes another thing that can be wrong without announcing it (I published "689 for
dynamic-dispatch" as doctrine inside a lesson about stale instruments; 222 files / 921 directives /
689 executed are three different numbers, and only the executed one has standing).
⇒ ⭐⭐**A two-sided drill CARRIES ITS OWN BASELINE** — it never needs the right total, only that the two
arms *differ*. That is why it survived every instrument defect in a task where all four checks above
failed. **Ask "does this comparison generate its own baseline," not "what is the right number."**
⇒ ⭐⭐**STATE THE COMMAND WITH THE COUNT.** Every one of these five was resolvable in seconds once the
exact pattern was published — and unresolvable while only the figure was.
⇒ ⭐**A directive count is not a run count** (availability filtering · `Ignored` status · the
consecutive-failure breaker all sit between them).

⚠️**Sibling shape, same root, different symptom: A SAMPLE FROM AN ONGOING PROCESS READ AS A POPULATION**
— 3 instances in one session: ⚑my "CPU-only exposure" inferred from the first two labels of a peer's
output (its neutered run actually failed `cuda 58 / cpu 53 / llvm 52 / vk 43` — a **GPU** backend caught
it); the peer's "three reviewers" then "five" from a growing stream (six dispatched); and "the process
is running" as a liveness check (can't distinguish work from a hang ⇒ use per-subagent timestamps).
⇒ ⭐⭐**Do not count a monotonically growing artifact. Compare against a RULE-PREDICTED set** (e.g.
`REVIEW.md:80-87` predicts which reviewers apply) **or block on process exit.**

## ⛔⭐⭐⭐ 2026-08-04 — THE MIRROR DIRECTION BIT ME, because I had filed only one polarity

This note was written about `search/code` **overcounting** (`total_count` counts MATCHES, `items[]`
caps at 30/page). On 08-04 I hit the **same two fields on a different endpoint, undercounting**, and
the lesson did not fire — because it was indexed as *"`total_count` lies"* rather than
*"`total_count` and the array can disagree, in EITHER direction."*

**The receipt (SLANGWIN5 / #12322, run `30885595493`):** I ran a "bound test" to decide whether
attempt 1 executed a `test-compile-regression` job:

```bash
gh api ".../actions/runs/30885595493/attempts/1/jobs" --jq '.jobs|length'   # -> 30
gh api ".../actions/runs/30885595493/attempts/1/jobs" \
  --jq '[.jobs[]|select(.name|test("ompile"))]|length'                      # -> 0   ❌ FALSE
```
I published "att1 ran **0** compile-regression jobs; 30 jobs each" as a *bound* test — the word
"bound" doing exactly the work it shouldn't. **`total_count` on that same response is 37.** The job
existed (`91920971585`, SLANGWIN5, `failure`) and sat outside the first page. With `?per_page=100`:
`returned=37`, and compile-regression = **1 on every attempt**.

⭐⭐⭐**THE RULE, both directions, one sentence: on any GitHub list endpoint the returned array is a
PAGE, and `total_count` is the population — a bound/absence claim requires them EQUAL.**
- **Overcount** (`search/code`): `total_count` 932 "files" vs 786 real paths ⇒ never cite `total_count` as an entity count.
- **Undercount** (`.../jobs`, `/issues`, `/comments`, any paged list): `array|length` 30 vs `total_count` 37 ⇒ never cite `array|length` as a population.
- ⭐**A returned `30`, `100`, or `250` is a PAGE DEFAULT, not a fact about the world.** Treat those exact numbers as an alarm, not data.

**Verbatim guard to run before any absence/bound claim on a list endpoint:**
```bash
gh api "<endpoint>?per_page=100" --jq '{total:.total_count, returned:(.jobs//.items//.//[]|length)}'
# equal  -> a zero from a filter is meaningful
# differ -> paginate (--paginate or explicit per_page) BEFORE claiming anything
```

⛔**Second-order damage, which is why this earns three stars: I used the truncated number to OVERRIDE
A PEER'S CORRECT CLAIM.** A sibling had written "att1/att2 both SLANGWIN5" (right). I "verified, didn't
inherit" — with the defective instrument — and published a correction against them, then relayed it
outward. ⇒ ⭐⭐⭐**When your fresh measurement CONTRADICTS a peer's, that is the signal to audit your
instrument, not to publish. A contradiction is symmetric: it establishes that one of the two is broken
and says nothing about which.** Recency and authorship are not evidence.

Related: [[feedback_control_the_instrument_not_the_reasoning]] (the uniformity generalization — a `30`
that agrees with your hypothesis is the dangerous kind) · [[project_slangwin5_spirv_val_runner_defect]]
(full receipts + the sibling defect **D1**: `runs/{id}/jobs` without `attempts/{n}` silently returns
only the LATEST attempt — a *different* mechanism producing the identical wrong answer; fix requires
attempt-scoping **and** `per_page`).

## Counting recipes (relocated from the MEMORY.md row, 2026-08-04 — these were INDEX-ONLY copies)

⛔**Counting repo-wide issues/PRs: use `search/issues` `total_count` at `per_page=1`. NEVER
`gh api --paginate ... | wc -l`.** On a `--paginate` failure `gh` exits 1, but the **pipe** returns 0,
so `wc -l` happily prints a short count and the error is invisible. If you must pipe, set
`set -o pipefail` first so the failure propagates.

⭐**State the command alongside any count you publish** — a bare number cannot be audited, and the
command is what makes the scope checkable (see the wrong-units instances above).
