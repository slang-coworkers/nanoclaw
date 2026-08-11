Reviewed at `20af817f` (post-`synchronize`), all four checks green on this head. Every claim below was measured against the pinned `ruff 0.16.2` binary, each probe paired with a control that could have returned the other answer. **No blockers.** Two notes.

## What I verified

**The scoping fix is the right one, and I can show the problem it solves was real.** At the first head `740ece1f` the `ci` job failed at step 12 of 24 on **74 findings, none of them in a file this PR touches** — 24 in `container/mcp-servers/slang-mcp`, 19+19 in the two `*-pr-approver` skills, 12 in `slang-pr-knowledge`, all arriving through the composed-branch merge. Because the gate sits *above* build/typecheck/tests, every one of steps 13–24 was `skipped`: that head carried **no test evidence at all**. Taking the file list from `$HEAD_SHA` fixes it at the right layer — the alternative (`exclude` in `ruff.toml`) would have gone stale the next time a sibling added a `.py`, exactly as the new comment says.

- **Gate passes on this head, and is not inert.** `ruff check` over the 16 files from `HEAD_SHA` → `All checks passed!` (rc=0). Reverting each fixed file to its `origin/nv-main` content and re-linting individually → **59 content findings across 13 files**. With the **14 mode-bit changes** (`git diff --summary`, `100644 => 100755`) that is **59 + 14 = 73** — the PR's count reconciles exactly.
- **File list vs. content can't diverge.** The list comes from the PR tip but the *content* linted is the composed tree, so I checked whether any of the 16 files exists with different content on a sibling: **none does** (0 of 16 across all four `nv-*` branches). No substitution risk.
- **`target-version = "py39"` is justified by execution, both directions.** `datetime.now(timezone.utc)` → clean at `py39`; at `py311` → `UP017 Use datetime.UTC alias`. The reasoning is correct: taking that advice would break the KB cron on any 3.10 box.
- **"Default set is the widest net" is accurate for 0.16.2.** A 5-line probe file drew `I001`, `F401`, `S110`, **`BLE001`** with `--isolated` and no `--select` — so the wide rules really are on by default, which is what makes the exact pin load-bearing rather than decorative.
- **All 8 suppressions are load-bearing.** `RUF100` confirmed active (a bogus `# noqa: BLE001` is flagged). Stripping the `noqa` per file fires every time: `test_learnings_wiki` 8, `kb-doctor` 9, `dump-scheduled-tasks` 5, `kb-health` 4, `test_pull_universe` 2. None decorative.
- **The three `json.JSONDecodeError` narrowings are behaviour-preserving — I read each try block, not just the diff.** All three wrap only `json.loads()` on a `str` from `text=True`, and each has its `OSError` path handled *separately and adjacently* (`kb-health` `except OSError: continue` on the `open()`; `kb-doctor` and `dump-scheduled-tasks` catch around `subprocess.run` one block up). The `(OSError, subprocess.SubprocessError)` pair also keeps the timeout path, since `TimeoutExpired` is a `SubprocessError` subclass.
- **173 tests, no change in outcome — confirmed on both sides.** All six suites at this head: 31+41+27+33+13+28 = **173, all OK**; the identical set at `origin/nv-main`: **173, all OK**.
- **Path-guard entry verified with both controls.** With the head allowlist → rc=0, `ok: all 19 changed file(s) match`. Swapping in `nv-main`'s *base* allowlist → **rc=1, naming `ruff.toml`**. The entry is doing work, and the `tsconfig.typecheck.json` precedent is the right one.
- **The `FakeGh` story checks out** as the diff describes: `check=False` reached a double whose `__call__` lacked the kwarg, and the blind `except Exception` around `subprocess.run` would have converted that `TypeError` into a reported fetch failure. Narrowing makes it loud. Good catch, and the honest premise-correction at the top of the description is the right way to file this.

## Two notes, neither blocking

**1. The new step fails open when `HEAD_SHA` is unreadable.** `git ls-tree` writing nothing on error is indistinguishable from a branch with no Python, and both exit 0:

```
$ bash step.sh deadbeefdeadbeef...   # bogus sha
fatal: remote error: upload-pack: not our ref deadbeef...
fatal: not a tree object
::notice::no Python on this branch — nothing to lint
rc=0
```
Control: a genuinely empty tree prints the same notice, also rc=0 — so the two states are byte-identical in the log. Not reachable today (`github.event.pull_request.head.sha` is always fetched by `actions/checkout` with `fetch-depth: 0`), so this is a latent robustness point, not a live defect. One line closes it: `git ls-tree ... || { echo "::error::cannot read $HEAD_SHA"; exit 1; }`, or `git rev-parse --verify "$HEAD_SHA^{tree}"` before the loop. Worth doing precisely because the empty-list branch is the *silent* one — this is the same "no third state between clean and unmeasured" shape as #1076.

**2. The gate's position means one lint error still hides all test signal.** Step 12 preceding build/typecheck/tests is what made the first head report zero test information. That ordering is fine for a fast fail *when the failure is yours*, but the composed tree can hand this branch a failure that isn't — which is the case you just fixed, one layer up. Moving the ruff step after `Host tests`, or giving it `continue-on-error: false` but a later position, would mean a future scoping surprise costs a red lint line instead of the entire suite's visibility. Judgement call, and reasonable to leave.

## One thing I could not check

No opinion on the `py39` floor being *sufficient* — I verified that `py311` would demand the 3.11-only alias, which is what the argument needs, but I did not verify the actual interpreter on the prod cron box or in the agent image. The description already scopes that to its own PR, which is the right call.
