---
name: project_nanoclaw_1154_ownership_one_matcher
description: "nanoclaw#1154 (szihs) folds ci.yml/setup.sh/merge-train.sh onto ownership.py. Reviewed inline at 02dcb609 (comment 5231698700): LGTM + 4 yellow. Headline: `|| : > $f` re-opens fail-open AFTER the probe passes (constructed: stale compose, exit 0); and the rewritten ci.yml block ran NO ci job because base != nv-main."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1154
---

# `slang-coworkers/nanoclaw#1154` — "path-guard: fold the three shell ownership readers onto the one matcher"

Author **szihs**. **Stacked on #1151** — base is `fix/nv-main/ownership-matcher-git`, NOT `nv-main`.
Branch `fix/nv-main/ownership-one-matcher`. 5 files, +206/−43. Reviewed **inline by Main** (~30th
instance of the standing rule: nanoclaw fork has no approver wired, webhook's generic
"route to `*-pr-approver`" overridden — see [[project_nanoclaw_pr874_webhook_route_approver]]).
Comment **`5231698700`**.

Two webhooks fired: `opened` (head `8ffe82a5`) then `synchronize` (head `02dcb609`).
✅**The synchronize was a PURE REBASE** — `git diff base...head` byte-identical across both heads
(393 lines each, only `index` lines differ). Established by diffing the two PR-diffs, not by
reading commit messages. Base #1151 also moved (`6f60824b`→`d515ac21`) because #1152/#1153 landed.

## The core claim REPRODUCES — 10 of 15 falsely owned

Old matcher = `git -c core.excludesFile=<nv-main.txt> check-ignore --no-index` run **in the project
repo**, which also consults `.gitignore` + `.git/info/exclude` + global excludes.

| matcher | owned of 15 | absent from `nv-main.txt` |
|---|---|---|
| old (in-repo `check-ignore`) | 15 | **10** |
| `ownership.py` (isolated empty repo) | 5 | 0 |

Each of the 10 traces to a live `.gitignore` line (`repos/`:45, `coworkers/*.yaml`:48,
`.claude/projects/*/memory/`:52, `forks.md`:59, `slang_kb/`:63, plus `groups/*`, `data/`, `logs/`,
`dist/`, `store/`).

⛔**MY FIRST RUN OF THIS PROBE READ 6, NOT 10 — because the shell had reset cwd to
`/workspace/agent`, which is NOT a git repo,** so `check-ignore` consulted no `.gitignore` at all.
A correct method on the wrong tree, exactly ANCHOR A. The tell was that 4 of the author's 10
"didn't reproduce" while 6 did — **a partial reproduction is the signature of a wrong-tree run**,
because a real disagreement rarely splits a single mechanism's output. Re-ran with
`git rev-parse --show-toplevel` printed first ⇒ 10/10. ⇒ **Print the toplevel in any command whose
answer depends on being inside the repo.**

## Revert drill + control set (both done)

- Checked out `setup.sh` + `merge-train.sh` from #1151, re-ran the 2 new tests with `-t ambient`:
  **both RED**, with the author's quoted assertion text. Fail-before/pass-after confirmed.
- 4 ownership test files at head: **73 passed** — matches the author's figure exactly.
- Full suite: base 1894 passed / 1 failed / 25 load-fail files; head 1896 / 1 / 25 with the
  **identical `FAIL` file set** (`diff` empty). ⭐My absolute totals are lower than the author's
  2168 because this checkout symlinks a borrowed `node_modules` instead of a frozen install ⇒
  **reported the DELTA (+2 pass, +0 fail) and named my env as the reason, rather than disputing
  their number** — per ANCHOR C, their figure is true about their edge.

## 🟡1 (the one worth fixing) — `|| : > "$f"` re-opens fail-open AFTER the probe passes

`merge-train.sh:112,151` · `setup.sh:270,304` · `ci.yml:101`. A matcher rc≠0 mid-batch is
swallowed into "nothing is owned" ⇒ canonicalization silently no-ops.

**CONSTRUCTED end-to-end**, one fixture, matcher as the only variable:

| matcher | script says | exit | `package.json` (nv-main-owned) |
|---|---|---|---|
| real `ownership.py` | `merged` | 0 | `{"v":"main"}` ✅ |
| answers `probe\0`, rc=2 on the real batch | `merged` | **0** | `{"v":"STALE-LEAF"}` ❌ |

That second row is verbatim the outcome the comment 3 lines above the probe says it prevents.
⭐⭐**The up-front probe proves the matcher ran ONCE ON THE LITERAL PATH `probe` — never that it
answered THIS batch.** Reachable rc=2: `mkdtemp` on a full/RO `/tmp`, git failing mid-run, a
candidate outside the repo (`../outside.ts` → rc=2, measured). `set -euo pipefail` is explicitly
disabled at exactly those 5 lines.

## 🟡2 — the rewritten `ci.yml` block had NO ci run in this PR

`ci.yml`'s `on.pull_request.branches` = `[main, nv-main, nv-dashboard, nv-slang, nv-slangpy,
nv-nanoclaw]`. Base is `fix/nv-main/ownership-matcher-git` ⇒ **only `guard` + `label` ran** (check-runs
at both heads confirm). And no test file references `ci.yml`. So the one copy of the edit with
neither CI nor unit coverage is the copy in CI itself. ⭐**A stacked PR's base branch silently
de-selects workflows whose `branches:` filter doesn't list it — check `check-runs`, never assume
"CI is green" means "CI ran".**

**I closed the gap myself:** extracted the 114-line block from the parsed YAML (hand-rolled
dedent — `yaml` module is absent here), ran it on a synthetic origin with the leak
(`echo 'groups/' > .gitignore`):
- PR block → `::error::… conflicts outside nv-main's owned set: groups/main/notes.txt`, aborts ✅
- same fixture, old matcher spliced back → `::notice::… taking HEAD (canonical) version`,
  proceeds ✅ **leak reproduced as a positive control**

## 🟡3 / 🟡4

- `setup.sh:190-191` still says *"Keep `fork_is_owned()` in sync with the `is_owned()` in
  merge-train.sh and ci.yml"* — all three deleted by this diff. Also `merge-train.sh:86`,
  `project-integrations.ts:18`, `claude-assist.ts:286`.
- `printf '%s\0' $conflicts` (unquoted) word-splits: `src/a b.ts` → `src/a` + `b.ts`, measured.
  The *canonicalization* loop IS NUL-safe (`git diff -z`); the *conflicts* loop isn't. Fail
  direction is safe (abort) and it is **not a regression** (old `is_owned "$f"` got the same
  fragments) ⇒ filed as a claim-SCOPE nit, not a bug. Per the ANCHOR B carve-out: a correctly
  stated invariant aimed at the wrong scope.

## ✅ Credit recorded — the version-skew hazard IS handled

Callers pass `-0`; `origin/nv-main`'s **current** `ownership.py` is line-mode + `pathspec`-based
with no `-0`. Measured: `printf 'probe\0' | python3 <nv-main copy> -0 <list>` → `usage: …`, **rc=2**
⇒ if #1154 landed before #1151 the probe exits loud instead of composing "nothing owned".
⭐**Ran the hazard rather than reasoning about it, and said so** — this is the fail-loud design
earning its keep, which is why 🟡1 (the hole in that same design) is the one blocker-adjacent item.

## Verdict + state

**LGTM, no blocker**, 4 yellow. Merge order and the new `python3`-in-`setup.sh` requirement (gated
behind `git ls-remote --heads origin nv-main` fork detection; those clones already run python3 for
`check.py`) left to the maintainer. CI at review time: `guard` pass (only job selected).
#1151 base: `ci` pending, `check`+`guard` pass.

**RESUME:** (a) szihs replies to 🟡1 ⇒ re-check the `|| { … exit 1; }` change; (b) #1151 lands and
#1154 retargets to `nv-main` ⇒ **the `ci` job finally selects and exercises the rewritten compose
block — read that run, it is the coverage 🟡2 is about**; (c) if it merges with 🟡1 open, the
fail-open is LIVE on nv-main and wants a follow-up PR.

Related: [[feedback_a_control_built_from_the_matchers_own_assumption_is_blind]] (#1151's adversarial
corpus is what made this bug findable — a 993-vs-993 tracked-file corpus structurally cannot see a
`.gitignore` leak, because ignored paths are untracked by definition),
[[project_nanoclaw_1150_ccusage_own_nvmain]] (the `ccusage` lockfile red that made every open
nv-main PR fail `ci` in 27s), [[project_nanoclaw_1120_owned_drift_verifier]].
