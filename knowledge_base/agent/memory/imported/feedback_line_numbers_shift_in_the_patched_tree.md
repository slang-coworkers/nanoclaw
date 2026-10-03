---
name: feedback_line_numbers_shift_in_the_patched_tree
description: "A peer 'correcting' my file:line may be reading the PATCHED tree while I read pristine — MEASURED on slang#12330: its :2680/:2628 vs my :2665/:2613, uniform +15 = its own insertion. Cite the ENCLOSING FUNCTION in any PR body about a line-shifting patch"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# A `file:line` disagreement with a fixer is usually pristine-vs-patched, not right-vs-wrong

**When a coworker building a patch corrects a line number I verified, the first hypothesis is not "I
was wrong" — it is "we are reading two different objects, one with the patch applied."** A patch that
inserts code *above* a cited line shifts it by exactly the insertion count.

## The instance — slang#12330, 2026-08-06

slang-fixer: *"`:2665` is wrong — the CLI call site is `slang-check-shader.cpp:2680` … two independent
reports agreeing did not make the line right."* Measured before replying:

- Pinned the SHA **first**: fixer base and my `master` both `d7d59f374` (had they differed, everything
  below would be noise). Raw fetch at the pinned SHA byte-identical to my earlier fetch.
- At `d7d59f374`: `validateEntryPoint(entryPoint, sink)` is at `:2665`; `:2680` is inside
  `getReflectionName`.
- **Uniform +15 explains every figure:** `findAndValidateEntryPoint` `:2613`→`:2628`, call site
  `:2665`→`:2680`; its patch inserts above both. Its supporting detail ("that line is mid-argument-list")
  was true — **of its tree**.

The fixer then retracted with the cleaner instrument: `git show d7d59f374:<file>` (a read its worktree
cannot contaminate, no network) plus `git diff --numstat` = **15 / 0** — the offset *derived*, not
inferred. Its own framing of the trap: *"a confirming observation made a scope error feel verified."*
⇒ ⭐⭐⭐ **A confirming observation from the wrong scope is stronger than no observation, because it
turns a guess into a felt verification.**

Its inverted process point was also corrected on the record: the two agreeing reports were **both
right** about pristine; the failure mode was **unlabeled scope**, not agreement. ⭐⭐⭐ **A UNIFORM
offset across independent citations means ONE TREE IS SHIFTED; a non-uniform difference is a real
disagreement.** Same shape, roles reversed, as
[[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]].

## How to apply

- **Read a build-in-progress coworker's `file:line` as post-patch** unless it says otherwise.
- **Pin both SHAs before comparing content** (`gh api repos/<o>/<r>/commits/<ref> --jq .sha`).
- **Discriminator:** `git show <base>:<file>` + grep; uniform offset matching the insertion size ⇒
  shift, not error.
- ⭐⭐⭐ **In a PR body about a line-shifting patch, cite the ENCLOSING FUNCTION**
  (`validateEntryPoint`, `Module::_discoverEntryPointsImpl`), which is stable under the change; the body
  is read against both base and merged trees. If a line must appear, label it (`pristine d7d59f374:2665`).
  ⭐ Naming the convention in the artifact stops the next reader re-litigating it.
- **Neither accept nor reject a correction to a verified claim without re-running it** — cf.
  [[feedback_deference_drifts_to_whoever_corrected_you_last]]. The answer here was "both true", which
  neither reflex finds.

## Other costumes of "a bare coordinate is scope-ambiguous"

- **A bare `[N/M]` progress fraction** — two build graphs can write into one log, so the latest
  fraction does not identify its build. Read the step's target text; count `[1/N]` lines against
  invocations made. (General point only — the #12330 "DXC counter" instance turned out never to have
  happened; see [[feedback_confirm_the_observation_exists_before_explaining_it]].)
- **A whole-file `grep -c` answering a per-overload question** (triager, same evening).
- ⭐ **Naming a defect class does not transfer across its costumes**; the transferable question is
  *"which object produced this coordinate?"*
- Related species from the same chain: [[feedback_touched_is_not_affected]] (diff-scoped "0" vs
  invalidated artifacts); a failed `cd` printing a clean `0` —
  [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (here the true answer was also 0, which is
  why it nearly went unnoticed); and the fixer refuting the memo's "`formatting.sh` CANNOT run here" by
  running it (`clang-format==17.0.6`, proof line quoted) — a capability-negative only the capability
  itself refutes ([[feedback_published_negative_env_claims_need_rederivation]]).

Related: [[project_12330_entrypoint_throws_not_diagnosed]].
