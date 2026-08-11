---
name: project_nanoclaw_1071_1072_ci_gate_onecli
description: "nanoclaw #1071 (merged w/ slurp+jq regression) — REGRESSION NOW FIXED by #1178, merged 2026-08-10 (blob 4bc85ecca93 on nv-main), which chose the OPPOSITE fix to the one I recorded here: drop --jq, keep --slurp. #1072 still PARKED by szihs."
metadata:
  node_type: memory
  type: project
  originSessionId: main-1072-ci-gate
---

# ci-gate → OneCLI main vault: #1071 (merged, defective) + #1072 (parked)

## STATE 2026-08-05
- **#1071 MERGED** (`nv-main` @ `0bef0a22`) **carrying a live regression.** Merged *during* my
  investigation — I opened it as OPEN, it closed mid-session. Posted the finding as an issue
  comment on the merged PR (`5188462079`), not a review (write path is verb-split).
- **#1072 PARKED** — szihs: *"not fixing it right now"* (`5188442155`). Findings posted
  (`5188465563`); no branch, no PR. RESUME = szihs's word.

## ⛔ RESOLVED 2026-08-10 by #1178 — AND MY RECOMMENDED FIX WAS THE WRONG HALF

**#1178 (szihs) merged the opposite choice and it is the better one.** I recorded *"FIX: drop
`--slurp`, keep per-page `--jq`"* below. #1178 instead **dropped `--jq`, kept `--paginate --slurp`**,
and moved selection into TS (`selectCheckRun`). ⭐⭐⭐**My version would have re-broken the
multi-page case the `--slurp` half was added to fix** — measured on a live slang head 2026-08-10:
**2 pages, 100 check-runs**, so per-page `--jq` genuinely emits one line per page. My "the
multi-line-tolerant parser makes that safe" reasoning leaned on a parser that takes the FIRST
non-`null/null` line — which silently picks whichever page happens to list a matching run first,
i.e. it *tolerates* the shape instead of reading it. #1178's TS selection reads all pages properly.
⇒ **"the two halves were designed for each other" was a real observation used to justify the weaker
of the two fixes** — tolerating a malformed shape is not the same as not producing it.

**Verified on my edge before commenting** (comment `5240602373`; merged mid-verification AGAIN — 4th
szihs/`nv-main` instance, exactly as the method note below predicts, so blob-hash-verified
`4bc85ecca93` rather than the branch, which 404s post-merge):
- bogus-repo argv control ⇒ `rc=1`, flag rejection, stdout EMPTY; positive control (no `--jq`) ⇒
  network reached (`Bad credentials` 401, non-empty body) ⇒ the PAIR is the fault, not the path.
- **`--slurp` without `--paginate` is ALSO refused** (`` `--paginate` required when passing `--slurp` ``)
  ⇒ only one legal combination survives. My store's leaf did not have this half.
- gh **2.97.0** on my edge vs 2.96.0 in the PR body ⇒ same behavior, not a version artifact.
- 12/12 tests pass, `tsc` clean; both claimed tampers each kill EXACTLY one test.
- ⚠️Could NOT verify the 4,964 / 81-of-100 prod figures — no host error log reachable from my
  container (mount is `groups/main` only). Not disputed; unverifiable by me.

**Open gap I reported (not a blocker, and NOT a claim the PR is wrong):** #1178 replaced the whole
test file and deleted the only test of `ci-check.ts:99`'s
`const { GH_TOKEN: _gh, GITHUB_TOKEN: _gt, ...ghEnv } = process.env` — the fix for the EARLIER 401
incident. On `nv-main` **no** test exercises `ci-check` (new file: 0 `GH_TOKEN` refs; the two
`github-webhook-*` test files' `GH_TOKEN` handling is `postEyesReaction`, and neither imports
ci-check). ⭐⭐**Both incidents on this function share ONE log line** (`probe failed — not releasing`
via `try/catch → false`), which is exactly why 4,964 failures went unread ⇒ a refactor dropping the
destructure reopens the 401 incident with nothing failing. Suggested `checkRunEnv(process.env)`
asserted the way `checkRunArgs` now is.

## The live defect on `nv-main`
`ci-check.ts:59-62` passes `--paginate --slurp --jq` together. **`gh` rejects that
client-side** ⇒ exit 1, **stdout empty** ⇒ `execFile` rejects ⇒ `try/catch → false` ⇒
`probe failed — not releasing`. ⭐⭐⭐**Byte-identical to the 401 signature it was written to
fix** — the PR's own diagnostic log line is what it still emits, so it reads as fixed while
failing 100% (was 98.3%). Instrument fact: [[command_gh_api_slurp_excludes_jq]].

**FIX (SUPERSEDED — see RESOLVED section above; this was the weaker half):** drop `--slurp`, keep per-page `--jq` with `.check_runs[]`. The multi-line-tolerant
parser #1071 already shipped (`.split('\n').find(l => l && l !== 'null/null')`) is what makes
that safe — *the two halves were designed for each other; only the flag reverts.*

⭐⭐ Its `ci-check.test.ts` asserts `args).toContain('--slurp')` against a **mocked**
`child_process` ⇒ pins the invalid flag as correct, reports green. Add one case that runs the
real `gh` against a **bogus repo** — validation is client-side, so no creds/network needed.

⚠️ #1071's body cites `harvest-reviews.py` as precedent; that file slurps **without** `--jq`
(`:64` flags, `:68` `json.loads`) — precedent for the OPPOSITE choice. Verify a cited precedent.

## What #1072 gets wrong (both found by reading, not guessing)
1. **Step 1/3 largely exist.** `src/mcp-registry.ts:53` `getOneCLIProxyEnv()` already does it
   host-side: `getContainerConfig()` → proxy+CA, combined CA bundle **scoped by
   `CONTAINER_PREFIX`** (co-hosted installs otherwise clobber each other's MITM CA — the
   non-obvious part), `rewriteProxy()` `host.docker.internal`→`127.0.0.1` (= the issue's target
   diagram), returns the 3 CA vars + 4 proxy vars, memoised. `ONECLI_URL` exists
   (`config.ts:99`). ⇒ **EXPORT and reuse it; do NOT add parallel config keys.** The issue cites
   an out-of-tree script as precedent and misses the in-tree one.
2. **Step 2 has a tenant gap.** Container tenant: 200 with only `GH_TOKEN` stubbed (129
   check-runs) ✅. But the `getContainerConfig()` credential returned
   **`app_not_connected` / 401** — GitHub is not connected for that agent. ⇒ step 1 is
   "connect GitHub for the host agent", not "build plumbing".
   `aoc_` token was **stable across calls** ⇒ fetch once, memoise (helper already does).
- Vault: 34 secrets incl. `GitHub (api repos shader-slang App)` ⇒ credential-exists claim ✅.
- Step 5 (`2>/dev/null || true` on `gh auth login`) is the real defect, **independent of the
  vault work** — one line, no dependency.

## Method notes
- ⭐⭐⭐**A bogus repo path isolates argv from credentials+network** — client-side validation
  fires first. Positive control: `--slurp` WITHOUT `--jq` reaches the network
  (`Bad credentials`), proving the pair is the fault, not the path.
- ⭐⭐**Verified the MERGED BLOB by hash** (`sha256:f2318511…`), not the branch — merge races
  are the norm for szihs+`nv-main` (#1066 −26s, #1068 +104s, now #1071 mid-session).
  ⇒ **recheck `state`/`merged` before drafting any verdict.** [[slang-nanoclaw-chains-index]]
- ⚠️`013675eb0c7f` now has **3** `check-ci` runs (skipped 09:32 / success 16:28 / failure 22:02
  UTC 08-04) — API is newest-first, `find()` takes newest. No longer the green example the PR
  body used; `.[0]` over re-run history is a silent policy choice.
- ⭐**The `--slurp` fact was already in my store from a prior #1071 session** — recall, not
  derivation. [[feedback_unattributed_fact_reads_as_your_own]]
