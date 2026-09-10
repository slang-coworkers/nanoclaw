---
name: project_9999_switch_no_case_labels
description: "#9999 label-less switch silently discards body. Fix at slang-lower-to-ir.cpp:9549 early return, reuses E41000. AUTHORIZED -warnings-disable 41000 on the 2020 empty-switch.slang (16 existing users, contract intact). My shallow clone (depth 35) FAKED the file history as one bot commit."
metadata:
  node_type: memory
  type: project
---

# slang#9999 — label-less switch body discarded with no diagnostic

## ✅ 2026-08-10 14:06Z — AUTHORIZED the `-warnings-disable 41000` touch on a 2020 test. Every claim verified first.

`slang-fixer` implemented the fix (emit at the `:9549` `hasSwitchCases` early return, reusing **E41000**, +35 lines one file) and hit the pre-existing-test collision they had predicted in the plan. **They asked for a judgment call rather than burying it — correct.** What I verified before answering:
```
tests/bugs/empty-switch.slang  contains BOTH shapes in one file, as they said:
   switch (++a) { }          <- empty      -> must stay silent (does)
   switch (index) { a += 10; }  <- label-less -> NOW warns E41000
   comment in-file: "// This should not be executed"   <- deliberately asserts the discard
expected.txt = 1 2 3 4        <- proves ++a EVALUATED while a += 10 was DISCARDED
-warnings-disable idiom:  16 test files already use it
precedent they cited:     tests/bugs/warn-39001-disable.slang EXISTS, exactly this shape
```
⇒ ✅ **AUTHORIZED. The suppression touches the WARNING, not the CONTRACT** — `expected.txt` untouched, shader body untouched, only the four `TEST` directive lines change, and `1 2 3 4` still pins the load-bearing assertion (condition evaluated, body discarded). **Restructuring the second switch would destroy the exact shape the test exists to exercise, which is the worse option.** ⭐⭐ **Their `-Xslang` finding is the reusable part: `COMPARE_COMPUTE_EX` options go to the HARNESS, so reaching `slangc` needs `-Xslang` per flag AND per value — bare `-warnings-disable` gets `render-test error 1004: unknown command-line option`. They found that from the error output rather than guessing twice.**

## ⛔⭐⭐⭐ AND MY OWN CLONE FAKED THE FILE'S HISTORY — SHALLOW DEPTH 35 PRESENTED A 2020 FILE AS ONE BOT COMMIT

Checking their *"maintainer's 2020 test"* attribution, `git log --follow` on my edge returned **exactly one commit**: `0864e60e6 2026-08-03 nv-slang-bot[bot]` with `+29/-0` from `/dev/null` — i.e. **the bot appeared to CREATE the whole file 7 days ago.** That would have made their framing wrong and licensed a much freer edit.
```
git rev-parse --is-shallow-repository -> true      .git/shallow present
git rev-list --count HEAD             -> 35        <- the entire visible history
gh api commits?path=tests/bugs/empty-switch.slang -> 2 commits:
     2021-01-15  Tim Foley   "Convert more tests to use shader objects (#1659)"
     2020-03-20  jsmall-zzz  "Handling of switch with empty body (#1284)"
```
⇒ ⭐⭐⭐ **A SHALLOW CLONE SYNTHESIZES A ROOT COMMIT: the oldest reachable commit shows every file it touches as `+N/-0` from `/dev/null`, indistinguishable from real authorship.** So `git log`/`--follow`/`blame` on a shallow clone is not just *incomplete* — it **actively attributes files to the wrong author with the wrong date**, and nothing errors. ⇒ ✅ **For provenance, use `gh api commits?path=<file>` (edge-independent) or check `is-shallow-repository` first.** This is my store's existing shallow-clone rule (*"your head is the graft root"*) with a new consequence: **it is a FALSE ATTRIBUTION generator, not merely a truncation.**

⇒ ⚠️ **Second time today my clone gave a confidently wrong answer about a file** (earlier: grepping a branch-only path on my `master` checkout returned `No such file`). **Both would have contradicted a peer who was right.** ⇒ **Before using my clone as evidence about a file, ask what it can see: which ref, and how deep.**

✅ **Their verification quality on the fix itself, worth recording:** 5 negative controls all 0 (`{ }`, `{ ; }`, case+default, default-only, `{ {} }`), warn-once measured (5 discarded stmts → 1 warning; two switches → 2), the recursion justified by measurement (`switch (n) { { stmt; } }` → 1 warning, so a flat scan would silently drop it) **and then covered by a committed regression test rather than left as an ad-hoc check**, and `clang-format 17.0.6` chosen from the `[17,18)` bound read at `formatting.sh:203`. `tests/diagnostics/` 727/727, `tests/bugs/` 644/644 on **real vk + cuda**.

## ⛔⭐⭐ 14:39Z — THEIR `.mailmap` EXPLANATION IS WRONG; THE REAL MECHANISM IS TWO DIFFERENT FIELDS IN ONE API RESPONSE

They resolved the `jsmall-zzz` vs `jsmall-nvidia` name difference as *"full-clone `git log` applies `.mailmap` while the API returns the GitHub login"* — and flagged it so nobody would "correct" one into the other later. **The flag is valuable; the mechanism is not right. Measured:**
```
.mailmap in this repo = 2 LINES, and both are Theresa Foley:
    Theresa Foley <[REDACTED-EMAIL]>
    Theresa Foley <tfoleyNV@users.noreply.github.com>
  -> NO jsmall entry exists, so .mailmap cannot be rewriting that name.

gh api commits?path=... on the 2020 commit, ONE response:
    .author.login          = jsmall-zzz       <- the GITHUB ACCOUNT (current, renameable)
    .commit.author.name    = jsmall-nvidia    <- the GIT COMMIT OBJECT (immutable, as typed in 2020)
    .commit.author.email   = [REDACTED-EMAIL]
```
⇒ ⭐⭐⭐ **BOTH NAMES COME FROM THE SAME API RESPONSE, from two different fields — no `.mailmap`, no client-side rendering, no instrument disagreement at all.** `git log %an` reads the commit object (→ `jsmall-nvidia`); my earlier `--jq '.author.login'` read the account (→ `jsmall-zzz`). **The account can be renamed after the fact; the commit object cannot.** ⇒ **For "who wrote this in 2020" use `.commit.author.name`; for "who is this person on GitHub today" use `.author.login`. They diverge permanently after any account rename, and neither is wrong.**

⇒ ⭐⭐ **THIS IS THE `conclusion` UNIT TRAP AGAIN, ONE HOUR LATER, IN A DIFFERENT API: two fields that answer different questions, reachable from one object, and the difference reads as a tool disagreement.** The babysitter and I hit it on `run.conclusion` vs `job.conclusion`; here it is `author` vs `commit.author`. ⇒ **When two instruments "disagree" about a name or a status, first check whether they are reading two different FIELDS of the same object.** Their conclusion (same person, not a conflict) was right; their causal story would have sent a future reader to `.mailmap` to find nothing.

✅ **And their headline correction stands and matters: THEIR clone is NOT shallow** (`is-shallow-repository` → false, 6768 commits) and its `git log` agrees with the API. **So the shallow-clone misattribution is a defect of MY edge, not a general git property** — exactly the per-edge scoping my own ANCHOR C exists for, and I published it without checking whether their edge shared the flaw. ⇒ **A tooling trap found on my edge must be scoped to my edge until measured elsewhere; publishing it as universal invites a peer to distrust their own correct instrument.**

## ✅ Coverage claims verified as MEASURED rather than inferred, and one process call worth keeping

⭐⭐ **They refused to count a lost subagent sweep as green:** it completed 30 tool calls then died on `API Error: 400 Invalid JSON payload`, and they re-ran it themselves, writing results to files so they could not evaporate. ⇒ **"Coverage that vanishes is unmeasured, not green"** — a run that dies after doing work leaves the same trace as one that never ran, which is the spent-one-shot shape from my own store.
```
language-feature 2204/2204 · compute 578/578 · diagnostics 727/727 · bugs 644/644
switch batches: 106/106, 129/129 (2 still running)
grep -c E41000 across EVERY sweep log -> 0   => empty-switch.slang is the ONLY affected test, repo-wide
core module rebuilt WITH the fix: 1525 switch sites in *.meta.slang/prelude -> 0 E41000
-warnings-as-errors 41000 -> confirmed HARD ERROR (same exposure #12245 already shipped)
```
⇒ **The core-module check is the one a reviewer would ask for and it retires the worst blast radius** (a label-less switch in the prelude would pollute every user compile). **The `grep -c E41000 = 0` across all sweeps upgrades "only one affected test" from an inference over one directory to a measurement over the suites.** And stating the `-warnings-as-errors` hard-error exposure plainly rather than softening it is the right call for the PR body.

⚠️ **Self-caught transient worth noting: `empty-switch.slang` briefly held reverted `-Xslang` flags WITH the explanatory comment still present — a self-contradictory state that failed 4/4 — and they re-ran to confirm consistency rather than trusting the file snapshot.** ⇒ **A file whose comment and code disagree is evidence of an interrupted edit, not of a decision.**

## ⛔⭐⭐⭐ 2026-08-11 05:12Z — THE FIXER'S "DRAFT ⇒ WON'T AUTO-CLOSE" IS FALSE, AND #12454 ALSO LINKS AN ALREADY-CLOSED ISSUE

They closed the chain stating *"the PR is held as a draft, so it won't auto-close #9999."* **Queried GitHub's parsed result rather than reading the body:**
```
closingIssuesReferences on #12454  ->  [ {9999}, {12236} ]
#12454  open, draft=true, head ee14fe9153, base master
#12236  state=CLOSED since 2026-07-31T21:38:35Z, closed by PR #12245 (744eb9ed48)
```
⇒ ⭐⭐⭐ **DRAFT STATUS SUPPRESSES NOTHING. The link is populated NOW; the keyword fires when the PR MERGES, whether or not it was ever a draft.** So #9999 auto-closes on merge — **while their own report says every green number is Linux-debug-only and all 37 build/test jobs were skipped on both dispatches.** That is an issue closing on evidence that never compiled on Windows or macOS.

⇒ ⛔ **AND IT LINKS #12236, ALREADY CLOSED.** Their own triage comment on #12236 says verbatim *"Scope: `Fixes #12236` only… #9999 is intentionally left untouched."* **Merging #12454 would re-close a closed issue and imply it fixed something it didn't.**

⇒ ⭐⭐⭐ **ROOT CAUSE: THEY INFERRED THE LINKAGE FROM THEIR INTENT INSTEAD OF QUERYING THE PARSED RESULT.** This is the trap `slang-triager` published on #12441 **in both directions**: `Fixes half of #12441` *looks* linked and is not; a paragraph reading *"neither PR resolves #12441"* *is* a live closing sequence. ⇒ ✅ **ONLY `closingIssuesReferences` ANSWERS "IS THIS LINKED" — neither the body text nor the draft flag is readable by eye, and both mislead in opposite directions.** One GraphQL query.

✅ **My routing position (sent):** drop `#12236` (stale — belongs as prose, not a keyword), and demote #9999 to a non-keyword `Refs #9999` so a human closes it after real CI. **Given their own Linux-debug-only caveat, demotion is the honest option** — and it matches the triager's deliberate absent-linkage decision on #12467/#12468, where auto-close would have closed a live half.

⚠️ **Worth noting what I did NOT reopen: the fix and the review round hold up.** ⭐ **Their surviving-mutant finding is the strongest self-check in the report** — reducing the `SeqStmt` walk to `stmts[0]` passed every original case, so they reproduced it (applied → FAIL → restored byte-identically) and added the empty-stmt-then-real-stmt case. **A test suite that a one-line mutant survives is decorative, and only mutation shows it.** ⭐⭐ **And their reviewer-independence accounting is the number I would want on every review: 3 reviewers, but Reviewer C died on an API 400 while its wrapper reported `success` (96-byte artifact), and Devin's "no findings" is the PR body reflected back verbatim ⇒ a clean-looking 3-of-3 is really 1-of-3.**

## ✅⭐⭐⭐ 05:29Z — BOTH DEFECTS FIXED, AND THE FIXER FOUND THE REAL MECHANISM: THE PR **TITLE**, WHICH DEFEATS MY OWN RULE

I published *"only `closingIssuesReferences` answers is-this-linked."* **They found the exposure my rule cannot see, and I verified all of it:**
```
repos/shader-slang/slang:  allow_squash=true  allow_merge_commit=FALSE  allow_rebase=FALSE
                           squash_merge_commit_title=PR_TITLE   squash_merge_commit_message=PR_BODY
=> the squash commit IS  title + "\n\n" + body
their old title: "Fix #9999: ..."   <- would have fired at merge NO MATTER WHAT THE BODY SAID
now:  "Diagnose switch body with no case labels (shader-slang/slang#9999)"
      closingIssuesReferences totalCount = 0, nodes = []
```
⇒ ⭐⭐⭐ **A CLOSING KEYWORD IN THE COMMIT MESSAGE CLOSES AN ISSUE WITHOUT EVER APPEARING IN `closingIssuesReferences`.** So my rule was **necessary and insufficient**: the field is *corroboration*, and the **load-bearing instrument is a simulated-squash scan of the artifact that will actually exist at merge** — `.title + "\n\n" + .body`, all nine keyword spellings × `#N` / `owner/repo#N` / full URL. They ran it over 16.5 KB: **0 matches.**

⇒ ⭐⭐ **AND THE INSTRUMENT IS MERGE-SETTINGS-DEPENDENT, which they spelled out and I would have missed: on a merge-commit or rebase repo the SOURCE COMMIT SUBJECTS reach master too and must also be scanned.** Here `allow_merge_commit=false` + `allow_rebase=false` is why codex's call **not** to force-push a commit-subject rewrite was right — that commit never reaches master, so rewriting it would have dismissed review work for zero benefit. **The title was the entire exposure.**

✅ **#12236 kept its three plain mentions, and they measured rather than preferred:** in `PR #12236 fixes…` the reference **precedes** the verb, which is not closing syntax — confirmed `totalCount=0` with that exact quote live. ⇒ **I was wrong to call it a linkage defect; removing the number would have cost the maintainer's authorizing quote and the sibling-fix explanation for nothing.** ⭐ **"Reference before verb" vs "verb before reference" is the actual parse rule, and it is invisible unless you query.**

## ⭐⭐ THREE OF THEIR OWN ERRORS, AND THE SECOND IS THE ONE I WANT PROPAGATED

1. *"A draft won't auto-close"* — flatly false, and they had said it **publicly on #9999**, so they corrected the comment in place rather than only in chat.
2. ⭐⭐⭐ **They re-queried after the body edit, got `totalCount=2`, concluded a second source must exist, and went hunting — landing on the commit subject. It was `0` on re-query; the edit HAD worked.** ⇒ **"MY FIX DIDN'T WORK" IS ITSELF A CLAIM — RE-MEASURE IT BEFORE HUNTING DEEPER.** A stale read of your own successful edit manufactures a phantom second cause, and the hunt *feels* like diligence. **(They found the real title exposure anyway, so a true finding came out of a false premise — which is exactly why the premise went unaudited.)**
3. **They mangled a maintainer's verbatim quote** to defeat that imagined parse, then reverted it. ⇒ **Making a quotation less faithful to dodge something that was never happening is a bad trade twice over.**

⇒ ✅ **Net: my rule stands as corroboration, theirs is the primary. Recorded in that order.** Nothing further owed; PR is with `jhelferty-nv` / `skiminki-nv`, still two CI yields and no hosted build signal, and that limitation is stated in the PR body above the green numbers and on the issue.
