---
name: project_nanoclaw_1151_ownership_matcher_git
description: "nanoclaw#1151 path-guard: replace pathspec with git-in-isolated-repo. Closes my #1120 P1s + #1134's. Reviewed inline at 6f60824b: 1 RED (--ref older-commit ⇒ exit 2, incl. the DEFAULT invocation pre-merge, because trusted-ref supplies the callee while worktree supplies the -0 caller), 1 YELLOW (check.py still C-quotes ⇒ non-ASCII OWNED path reported as violation, flips on core.quotePath). CI red = base skew reproduced on the unmodified merge-base. Comment 5231578152."
metadata:
  node_type: memory
  type: project
  originSessionId: c649406a-fb08-466d-aac2-2a0cfb73d12b
---

# `slang-coworkers/nanoclaw#1151` — "path-guard: match ownership with git in an isolated repo, not a fetched package"

Author **szihs** (human), base `nv-main`, branch `fix/nv-main/ownership-matcher-git`, head **`6f60824b`**.
8 files +956/−158. Merge-base `8d108b2f`; `nv-main` moved to `320a9e33` (#1150) then `0f9cab40`
mid-review. **Stacked child: #1154** (folds the three remaining shell readers onto the matcher).

**ROUTING: handled INLINE by Main (~30th instance)** — nanoclaw platform-infra fork, no nanoclaw
approver wired; the `pr_ready_for_review` webhook's generic *"route to the project's `*-pr-approver`"*
string is overridden. See [[project_nanoclaw_pr874_webhook_route_approver]].

**Closes my own #1120 findings 1+2 and #1134's two** — [[project_nanoclaw_1120_owned_drift_verifier]].
Approach: delete `pathspec` entirely, matcher becomes `git check-ignore` in a freshly-`init`ed empty
repo with every ambient ignore source neutralized. Comment **`5231578152`**.

## 🔴 The blocker: trusted-ref supplies the CALLEE, worktree supplies the CALLER

⭐⭐⭐**The fix that sources the matcher from a trusted ref creates a version skew ACROSS the very
boundary it hardens.** New `check-nv-owned-drift.sh` passes `-0`; no older `ownership.py` accepts it.

| `--ref` | result |
|---|---|
| `origin/nv-main` (`320a9e33`) = **the DEFAULT** | `usage: ownership.py <allowlist-file>` → **rc=2** |
| `d12c28b11` (#1134) | rc=2, same |
| `a6d588ebc` (pre-#1134) | rc=2, `pathspec required` |
| **`pr1151`** (control, carries new matcher) | **rc=0** `ok: no nv-main-owned file differs` |
| old script + current `origin/nv-main` (control, shipped today) | rc=1 — it *runs* |

⇒ bare `bash scripts/check-nv-owned-drift.sh` is rc=2 for every developer **until this merges**
(self-heals on merge, so not a shipping regression) and `--ref <older>` — a documented `-h` capability
— is **permanently** exit 2. ⭐⭐**The docstring anticipates the MIRROR image** ("line mode remains the
default so a caller composed from an older branch keeps working" = old-caller/new-matcher) and misses
the direction its own design creates.

## 🟡 `check.py:68` still `git diff --name-only` without `-z`

PR made the drift script NUL-clean end to end but left the other reader C-quoting. With `docs/**`
owning all three files: `docs/café.md` + `docs/日本語.md` reported as **violations**, `docs/plain.md`
passes as control. **Fail-closed** (checked the converse: unowned `src/café.ts` still flagged) ⇒ 🟡.
⭐⭐**Why it still matters: same ambient-config sensitivity the PR exists to kill.** One flip,
same tree — `core.quotePath=false` → `ok: all 5 match`, rc=0; default → rc=1 with 2 violations. The
verdict depends on a git setting outside the allowlist, one layer up in the *caller*.
⚠️**Bounded by measurement: 0 non-ASCII tracked paths across all 5 branches (1,017 scanned on
nv-main; 0 with spaces too).** Latent. Newline-in-owned-path is the same defect (`.github/a\nb.yml`
under `.github/**` → violation).

## CI red = base skew, reproduced on the UNMODIFIED merge-base

⭐⭐⭐**The decisive control the author's own note lacked: replay compose verbatim on a tree with
this diff NOWHERE in it.**

| tree | pkg/lock ccusage post-compose | `pnpm install --frozen-lockfile` |
|---|---|---|
| base `8d108b2f`, **no PR diff** | 1/0 | **rc=1 `1 dependencies were added: ccusage@20.0.19`** |
| PR head | 1/0 | rc=1 same |
| PR head **rebased on `320a9e33`** | 1/21 | **rc=0** |

Mechanism confirmed from my log: `nv-dashboard: pnpm-lock.yaml conflict — taking HEAD (canonical)`
while the `package.json` line auto-merges. Author's bisect (#1152 also red identically, #1150 green)
independently agrees. **Not charged.**

## Verified by execution, each with a control

- **Revert drill on the 5 new drift tests** — old script + new tests → **exactly 5 fail / 14 pass**,
  the 5 the body names. ⭐⭐**No expectation dropped: `it()`-name set diff +6/−0 (13→19), 11 removed
  lines all comment/setup.** (Per [[project_nanoclaw_1150_ccusage_own_nvmain]]: when the test file
  changes alongside impl, hash check unavailable ⇒ diff the NAME SET.)
- **Isolation, all leak sources planted at once** (repo `.gitignore` + `.git/info/exclude` +
  `XDG_CONFIG_HOME/git/ignore` + global `core.excludesFile` via `HOME` + poisoned `GIT_DIR`/
  `GIT_WORK_TREE`): new → `['docs/private/s.md']`; **old in-repo control → `['overlay/leak.ts',
  'docs/private/s.md']`** (leaks).
- **Equivalence on MY corpus with MY `pathspec` 1.1.1** — 5 allowlists × 1,262 tracked paths =
  **6,310 comparisons, 0 disagreements**; `match_file` ≡ `match_files` sampled. Positive control:
  negation case shows git=owned / pathspec=not.
- ⭐⭐⭐**Golden corpus is genuinely hand-written — checked MECHANICALLY, not eyeballed.** Parsed all
  20 cases out of the .ts and ran each expectation through **both** engines: 20/20 match git, exactly
  1 differs from pathspec (the documented negation case). **This rules out the failure mode where a
  "golden" corpus merely records the new implementation's behaviour.**
- **`pathspec` genuinely absent on my host** (`ModuleNotFoundError` as control) → 61/61 pass.
- **Residual trust assumption CONSTRUCTED** (the body states it honestly): PR touching unowned
  `src/leak.ts` *and* stubbing `match_files` to return everything → **`ok: all 2 match` rc=0**;
  clean-matcher control → rc=1 flags the leak. Deferral to its own PR is correct.
- **Qodo entries record existing truth**: both skills on **all 5** branches at byte-identical blobs
  `69abaf76` / `c0cbe227` / `600dea81` ⇒ not widening.
- `-h` awk fix real: 46 lines vs 35 from the hardcoded `sed -n '2,36p'`.
- Leaf branches carry **0** files under `.github/nv-path-guard/` ⇒ the `*.txt`-only narrowing cannot
  fire as drift on them today.

## ✅ Scope note reproduced — with a CORRECTION for #1154

Author's 2nd comment (three shell readers still leak) is accurate; over 1,274 candidates the in-repo
method owns **10 more** than allowlist-alone (`allowlist-only-but-not-ambient = 0` as control).
⭐⭐**Correction I supplied: the four `coworkers/*.yaml` in that leak set are REALLY TRACKED** — 3 on
`nv-slang`, 1 on `nv-slangpy`, matched by `.gitignore:48` — not synthetic like `.env`/`data/v2.db`.
⇒ on the **composed-merge** path the leak can auto-resolve a live overlay file toward nv-main as
"owned", i.e. **silently drop a leaf's content**, not merely widen a set. That is the only case in
the 10 with that consequence.

**RESUME** = szihs pushes (a) the `-0` capability probe / better error in the drift script and
(b) `-z` in `check.py:68` ⇒ re-run `--ref` against `origin/nv-main` AND an older commit (both must
leave rc=2 only with a cause-naming message), re-construct the non-ASCII owned path with
`core.quotePath` flipped **both** ways, and re-diff the test-NAME set. Also watch **#1154** (stacked
child) — my `coworkers/*.yaml` correction lands there. Related:
[[project_nanoclaw_1120_owned_drift_verifier]], [[project_nanoclaw_1150_ccusage_own_nvmain]],
[[project_nanoclaw_1083_drift_check_empty_allowlist]],
[[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]].
