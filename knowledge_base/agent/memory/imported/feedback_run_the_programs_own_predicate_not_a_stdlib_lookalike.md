---
name: feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike
description: "To test what a program decides, import and call ITS predicate — a stdlib lookalike that agrees on your sample is unfalsified, not validated. Measured: fnmatch vs the skill's glob_to_re diverge on 3 of 8 cases."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# Run the program's own predicate, not a stdlib lookalike

⛔**When you need to know what a program would decide, import and call **its**
function.** A standard-library equivalent that *agrees on your sample* is
**unfalsified, not validated** — and the sample you happen to pick is usually the
region where the two agree.

## The measurement that earns this

Testing whether `external/**` protects `external/slang-rhi` (a submodule gitlink,
**no trailing slash** — the ambiguous case):
- ✅I loaded the skill's own matcher and ran it — `glob_to_re('external/**')`
  compiles to `^external/.*$` because `**` → `.*` **with the following `/`
  consumed** ⇒ **HIT**.
- ⚠️A peer used Python's `fnmatch` and got the same answer — **by luck.**

**MINE-MEASURED divergence, `fnmatch` vs `glob_to_re`, 3 of 8 cases:**

| glob | path | `glob_to_re` | `fnmatch` |
|---|---|---|---|
| `**/*.yml` | `ci.yml` | **True** | False |
| `**/CMakeLists.txt` | `CMakeLists.txt` | **True** | False |
| `src/*/x.c` | `src/a/b/x.c` | **False** | True |

⇒ They differ exactly on **separator-crossing**: `glob_to_re`'s `**/` matches
**zero directories** (so a root-level file matches), and its single `*` does
**not** cross `/` (so `fnmatch` over-matches). **A bare `**` suffix is one of the
few shapes where they coincide** — precisely the shape we tested. A decisive
`**/*.yml` or a mid-pattern `*` and the two methods would have given opposite
answers on a clause that gates a supply-chain surface.

## ⚠️ Running the right predicate is HALF the job — the INPUTS must be spelled as the evaluator sees them

**Immediately after filing this rule I broke its sibling.** I ran the correct
`glob_to_re` over **submodule-root-relative** paths (`.github/workflows/ci.yml`)
when the evaluator would see them **prefixed**
(`external/slang-rhi/.github/workflows/ci.yml`). Right matcher, wrong strings:
reported **9 hits**, actual **22**, and the *reason* for the hits changed
entirely (`external/**`, not `.github/**`).

⇒ ⭐⭐⭐**A predicate test has two halves — the function AND the domain. Using the
real function on paths anchored to a different root is as wrong as using
`fnmatch`, and it LOOKS more rigorous because the function is authentic.**
✅**Before trusting a match count, ask: where does the evaluator's path string
START?** (repo root? submodule root? absolute?) A compare-API filename and a
clause's `f["filename"]` are not interchangeable.

⭐**Note the ordering irony worth keeping:** the corrected run *also* revealed the
bundle's `external/**` matches the **outer gitlink entry** directly — which
narrowed my own over-claim. **Fixing the input didn't just change a number; it
changed which mechanism was operative.**

## How to apply

```python
import importlib.util
spec = importlib.util.spec_from_file_location("m", "/path/to/the_program.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.the_predicate(...)          # the real thing, not an approximation
```

If the module has import-time side effects, extract the function body with a
regex and `exec` just that — still the program's code, not a lookalike.

⭐**Where a code path is short and side-effect-free, EXECUTE the other branch
instead of reasoning about it.** Twice in three days the terminating move was
~10 lines: fetch the input, branch exactly as the source branches, print the
verdict. **Runnable from round one, both times.** Unbounded argument lost to
minutes of execution — and both times the argument *felt* productive because each
round surfaced real facts. ⇒ ⚠️**"Each round is producing findings" is not
evidence the method is right; it is how an unbounded argument sustains itself.**

⭐⭐**Agreement with an approximation is the weakest possible evidence, because it
is what you expected.** Suspect it hardest when it confirms you — same shape as
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]] (an exhaustive
census over the wrong population) and the "suspect a new instrument whose first
act CONFIRMS your prior result" rule.

## ⛔ Rescued from the index row, 08-05 — this lesson existed NOWHERE ELSE

The `MEMORY.md` row pointing here carries a second lesson that was **never written into this
child**, so trimming that row would have destroyed it. Verified by
collapse-and-squeeze grep (`tr -s '[:space:]' ' '` then case-insensitive): `closure` → **0 hits** in
this file. Preserved here now:

⭐⭐**`in full-closure?` is a DIFFERENT check from `lost at the bound?` — run both.** When this file
was created it had **zero inbound links**, making it unreachable *at any bound*, not merely past one.
My bound-check printed a reassuring **ZERO lost targets** while the file had no parent at all: the
bound-check only asks *"does a cut darken a row that is currently reachable?"*, so a row that was
never reachable is invisible to it. Two questions, two instruments — the same shape as this file's
core lesson (an instrument that cannot distinguish the states you care about is worthless).

⇒ ⭐⭐⭐**An index row can be the PRIMARY record, not a summary.** In a store written concurrently by
sibling sessions, whoever wrote the row may have been interrupted before the child landed — a 429
mid-bookkeeping is enough (exactly what happened on slang-rhi#813, see
[[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]]). *"The index only holds summaries"*
is an assumption about a file you haven't opened. **Confirm the child holds the detail BEFORE
shortening any row, with a collapse-and-squeeze case-insensitive grep — a line-wrapped phrase returns
a FALSE ZERO, and a hit may carry the WORD without the RULE.**

## Evidence base

ONE measured instance of the divergence (08-05, `glob_to_re` vs `fnmatch`, 3/8),
but the **mechanism is structural and readable** — two independently-written
matchers with different separator semantics — so it is not a
single-observation generalization. The companion half (*execute the short branch
rather than argue*) has **two** instances in three days: this, and the
`json.loads` counterfactual in
[[project_approver_pipeline_defects_devin_fetch_ci_green]].

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] ·
[[feedback_a_config_conditional_mechanism_needs_the_config_read]]
