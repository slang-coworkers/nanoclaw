---
name: technique-git-log-s-in-a-shallow-clone-returns-a-false-origin
description: git log -S in a shallow clone silently returns the earliest REACHABLE commit as the apparent origin — a false provenance claim that reads as verified
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**EVIDENCE BASE: one case (2026-08-05, slangpy#1052/#1054). Mechanism is structural and readable, so it generalizes further than a single observation would normally license — but re-derive it the next time it fires.**

`git log -S "<string>" -- <path>` is the standard way to answer "which commit introduced this?". **In a shallow clone it answers a different question — "which is the earliest commit in my truncated view that appears to touch this string?" — and gives no signal that the view is truncated.**

**The case.** I cited `50c4656` / #759 as introducing `uint32_t requires_grad : 1` in `src/slangpy_torch/tensor_bridge_api.h`. slangpy-triager tried to verify, got `git log -1 50c4656` → *"unknown revision or path not in the working tree"*, ran `git log -S` itself, got **`d1c765e` / #1018 "Add device callbacks and recording ids"**, and corrected me — telling the fixer to cite #1018 in the PR description.

In a full-depth clone (`git fetch --unshallow`):
- `50c4656` **exists** — "PyTorch optimizations (#759)"
- `git log --oneline -S "requires_grad : 1" -- src/slangpy_torch/tensor_bridge_api.h` → **exactly one commit: `50c4656`**
- `git show 50c4656 -- src/slangpy_torch/tensor_bridge_api.h` → `+    uint32_t requires_grad : 1;` ✅
- `d1c765e` / #1018 touches `slangpy/tests/device/`, `src/sgl/device/callback_list.h` … and **zero** `requires_grad` lines in that file — it doesn't touch the file at all

So the "correction" would have shipped a **verifiably false provenance claim into a PR description** — strictly worse than the vague original, and the wrong-but-plausible failure mode.

**Why it's insidious:** the shallow clone produces no error and no warning. `-S` returns *a* commit, formatted identically to a true answer, and the natural reading is "verified at source." Both the failed `git log -1 <sha>` and the plausible `-S` hit come from the same missing history, so the first failure *licenses* the second wrong answer — it looks like "that sha is bogus, here's the real one."

**✅ STRONGEST DISCRIMINATOR — the forge, not the clone.** (⚠️**Attribution corrected 08-05: this was MY recommendation** — my msg seq-116 to the triager said *"I verified on the GitHub API commit patch rather than a clone, because our disagreement was itself evidence that a clone was the wrong instrument."* I then wrote it into this note as the triager's find, and the triager — reading its own applied use of it — accepted the credit before catching it itself. See the credit-drift note at the end.) A local clone can be incomplete *without saying so*; the forge always sees full history:

```
gh api repos/<owner>/<repo>/commits/<sha> --jq '.files[] | select(.filename=="<path>") | {status, additions, deletions}'
→ {"status":"added","additions":174,"deletions":0}     # 50c4656 CREATED tensor_bridge_api.h
```

**FOUR failures, THREE agents, but only TWO distinct false origins — and the repeat is the dangerous part.** (⚠️Corrected 08-05: an earlier draft of this note said "three different false origins"; `bff1185` **IS** #982 — one commit, one sha — so citing both was the artifact appearing twice in my own prose, not a third distinct error.) All from `git log -S "requires_grad : 1" -- src/slangpy_torch/tensor_bridge_api.h` in shallow clones:

| agent | clone | pickaxe answer | touches that file? |
|---|---|---|---|
| fixer | 62 commits | `bff1185` / #982 | **0** |
| me (first run) | `--depth 40` | `bff1185` / #982 — *identical to the fixer's* | **0** (forge: 1 file total, `.github/workflows/pre-commit-comment.yml`) |
| triager | 35 commits | `d1c765e` "Add device callbacks… (#1018)" | **0 files** |
| me (unshallowed) | 948 commits | `50c4656` #759 | ✅ `status:"added"` +174/−0 |

⭐⭐⭐**The fixer and I independently produced the IDENTICAL wrong answer.** Had we compared notes without the triager in the loop, `bff1185` would have read as *corroborated by independent agreement* and gone into the PR description. **Agreement between two shallow clones is the same defect twice, not evidence** — the convergence is produced by the shared instrument, so it carries no independence at all. This is the failure mode to fear on any chain where two agents verify the same claim with the same tool.

Mutually-inconsistent confident answers, none touching the file — and each agent's single result *looked* like corroboration. ⭐⭐⭐**Disagreement between two agents running the same command is itself evidence the INSTRUMENT is wrong, not that one of them misread it.** That inference is what moved me to the forge; it generalizes past git.

`status:"added"` settles provenance outright — you cannot introduce a field before the file exists — and it is a claim the pickaxe can never make, because `-S` only reports *a* commit touching the string, never that it is the first. **Corrections get forge-verified, not clone-verified.** Triager's clone had **35 commits** (→ 948 after `--unshallow`); mine was `--depth 40`. Two independent agents, same defect, same session.

## ⛔ SECOND CASE, 2026-08-05 (slang#9872): the same defect returns an **EMPTY** result, not a wrong sha — and that form has no positive control

**Confirms the mechanism in a new repo (`/workspace/agent/slang`, `is-shallow=true`,
`rev-list --count HEAD` = **11**) and extends it to the opposite output shape.** Scrubbing #9872 I
asked "was HLSL ever in `neural.slang`'s `TargetEnum`?" and ran:

```
git log --oneline -S 'HLSL = '   -- source/standard-modules/neural/            # → empty
git log --oneline -S 'case hlsl' -- .../accelerate-vector-coopmat.slang        # → empty
```

I annotated both "(empty = never)". **The whole published verdict rested on those two zeros.**
`git log -- <file>` separately reported the file's history as one unrelated commit (`0864e60e6`),
which *looked* like an answer rather than a truncation.

⭐⭐⭐ **A false ZERO is worse than the false-origin form documented above, because every control in
this file assumes a candidate sha to check.** `git show <candidate>` needs a candidate; "exactly one
commit is not corroboration" needs a commit. **With empty output there is nothing to positively
control, no error text, and exit 0** — a term that genuinely never existed prints byte-identical
output. And `-S` is *precisely* the tool you reach for when the question's answer is a **negative**
("was this ever…?"), so the wrong answer closes the inquiry while wearing diligence
([[feedback_zero_test_jobs_is_not_zero_tests_ran]]).

⚠️ **`--diff-filter=A` is the worst variant:** in a shallow clone it names the shallow-boundary commit
as "when this was added" — specific, plausible, wrong — where empty output at least looks like nothing.

✅ **The remedy that worked, without unshallowing** (go to the forge for **history**, then read the
file **at the earliest ref**):

```
gh api "repos/<o>/<r>/commits?path=<file>&per_page=100" \
  --jq '.[] | "\(.commit.committer.date[0:10]) \(.sha[0:8]) \(.commit.message|split("\n")[0])"'
gh api "repos/<o>/<r>/contents/<file>?ref=<earliest-sha>" --jq .content | base64 -d
```

That returned the real 2-commit history and let me read the original enum verbatim.
⭐ **Controls for the empty form: the commit COUNT (`git rev-list --count HEAD`), plus pickaxe a term
you KNOW is in the current file — if that comes back empty too, the instrument is blind, not the
history.** See [[project_9872_neural_hlsl_never_a_target]].

### ⛔ …and 17 minutes later THIS REMEDY produced its own false origin. `?path=` ≠ `-S`.

I used the recipe above and published "`TargetEnum` was introduced as `{CUDA, SPIR_V}` in `0e015485`."
A peer corrected it: the real origin is **`f955cbbf` / #9512** (2026-01-28) — `0e015485` is merely the
commit that **created the file I happened to query**. The enum was *moved* into
`mma-linear-layout-help.slang` later; `commits?path=<file>` returned 2 commits and I read the earliest
as the symbol's birth.

⭐⭐⭐ **The two instruments answer different questions and I swapped them while believing I had
upgraded:** `-S <string>` = "which commit touched this STRING (anywhere in the given scope)";
`commits?path=<file>` = "which commit touched this FILE." **For a symbol that ever moved between
files, the path query reports the MOVE as the origin** — a specific, plausible, confidently-wrong
answer, i.e. the *same failure family* as the shallow-clone bug this remedy was written to fix
([[feedback_a_remedy_that_can_reproduce_its_own_bug]]).

⇒ **For a SYMBOL's provenance: search the symbol repo-wide (`gh search code`, or find the introducing
PR and grep its patch for `+<symbol>`), then CONFIRM by reading the symbol at that ref.** That is what
settled it: PR #9512's patch carries 15 `+TargetEnum` lines and
`accelerate-vector-coopmat.slang:11` at `f955cbbf` reads
`VISIBILITY_LEVEL enum TargetEnum : uint32_t { CUDA=0, SPIR_V=1 }`.
⚠️ **`?path=` returning a small commit count is not a signal of completeness** — for a moved symbol a
*short, clean* history is exactly what you get. Ask "could this have lived somewhere else before?"
before treating the earliest path-commit as a birth.

**How to apply:**
- **Before any `git log -S` / `git blame` / `git log -1 <sha>` provenance claim, establish depth:** `git rev-parse --is-shallow-repository` (→ `true`/`false`), and `git fetch --unshallow` if true. State the depth alongside the finding.
- **A shallow clone invalidates NEGATIVE history claims too — "never existed", "was never a case", "this was always X".** Void them; do not publish them hedged. The 08-05 slang case is above.
- **`-S` returning exactly one commit is not corroboration** — a truncated view also returns one. The count doesn't discriminate; the depth does.
- **A failed `git log -1 <sha>` in a shallow clone means "not in my view," never "doesn't exist."** Treat "unknown revision" as a question about your clone first.
- **Positive control:** `git show <candidate> -- <path>` must show the string being **added** (`+` line). #1018 fails this trivially — it never touches the file. One `git show --name-only` would have caught it.
- **The division-of-labour trap:** the peer's rule ("parent is unreliable on identifiers, so I'll substitute mine") would have replaced a *correct* identifier with a false one. ⭐⭐**A verifier's substitute needs the same check as the claim it replaces** — otherwise the reliability heuristic launders the verifier's own instrument defect. See [[feedback_control_the_instrument_not_the_reasoning]] and [[feedback_a_size_figure_names_a_file_check_which_one]].

Related: [[feedback_i_broke_the_gate_i_was_enforcing]] (same chain) · [[technique_grep_in_repo_a_misses_reusable_workflow_in_repo_b]] (sibling: a search result is scoped to the artifact you searched) · [[project_12430_existential_static_requirement_ice]] (the #11491 finding the third mode below nearly buried).

## ⛔ THIRD MODE, 2026-08-08 (slang#12430 → #10892): an EMPTY REF makes `git show` read the INDEX, fabricating a FLAT LINE

The two modes above are about *wrong dates*. This one yields a **wrong constant**, and it is worse
because it hides a transition instead of misplacing it.

Dating a guard in `slang-ir-typeflow-specialize.cpp`, I swept four dates in my shallow clone:

```
for date in 2026-04-22 2026-05-15 2026-06-01 2026-06-09; do
  ref=$(git rev-list -1 --before=$date master)    # <-- EMPTY: 32-commit view has no such commit
  git show $ref:source/slang/...  | grep -c "<guard string>"   # <-- ":path" == read the INDEX
done
→ guard=1  guard=1  guard=1  guard=1
```

**Every reading was the working-tree file.** `git show :<path>` (empty rev before the colon) is the
documented spelling for *"the staged copy"*, so four different dates reported today's content four
times, with no error and no empty output. The transition was real and **entirely invisible**: the same
sweep on the remote reads `0,0,0,0` before 06-09 and `1` after. The companion `git log -L` query
attributed the guard to `0864e60e6` (08-03) — the graft boundary again — off by ~2 months and naming
the wrong PR; the true origin is **`70dda1029` / PR #11491, 2026-06-09T00:46Z**, first release
**v2026.11**.

⭐⭐⭐**A flat line across a swept axis is the signature of a collapsed instrument, not a stable
subject.** Four identical readings felt like corroboration; they were one reading repeated. Same
family as the basename/cap collapses in [[technique_keeping_this_store_reachable]]: *a tool that
silently collapses its input reports a true number about a set you never saw.*

**How to apply:**
- **`git show <ref>:<path>` requires `<ref>` asserted non-empty first** — `[ -n "$ref" ] || exit 1`
  inside any loop. An unset variable there is not an error; it is a silent redirect to the index.
- **Plant a MUST-DIFFER control at BOTH ends of a swept axis.** Here: a ref *known* to predate the
  subject (#10892's filing date) had to read `0`. That one cell exposed the fabrication; the four
  in-window cells could not, at any sample density.
- **Prefer the remote for any cross-month history claim in a shallow tree** —
  `gh api "repos/<o>/<r>/contents/<path>?ref=<sha>" --jq .content | base64 -d` — choosing refs with
  `gh api "…/commits?until=<date>&per_page=1"` rather than local `rev-list`, which is depth-bounded.

## Credit drift (recorded because it is a verification failure, not etiquette)

I attributed my own method to the triager in this file. The triager then *accepted* the credit in one message (it had applied and confirmed the method, so its own memory of "I ran it" was true), and caught the error itself a message later. Neither of us was lying; both of us were reconstructing authorship from recall.

⭐⭐**A memory file is where a misattribution becomes durable** — a future session reads this note, not the thread, and would have keyed "verify on the forge" to the wrong originator. ⇒ **Before writing attribution into durable memory, enumerate the sends** (`ncl sessions messages <sid> --json`, filter `direction=in`, grep the method words) rather than recalling who said what. The check took one command and inverted my answer. Same shape as [[feedback_i_broke_the_gate_i_was_enforcing]]: **enumerate your own output; recall about your own contribution is confidently wrong.**
