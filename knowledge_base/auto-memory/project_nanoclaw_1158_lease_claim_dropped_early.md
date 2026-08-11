---
name: project_nanoclaw_1158_lease_claim_dropped_early
description: "nanoclaw#1158 (szihs) replaces the mkdir clone lock with a link()-published token lease. CI red on its OWN headline concurrency test — REAL defect: reclaimStaleLease drops the claim (:307/:277) before the new lease is published, so the 'unreachable' sameLease=false branch fires 44/120. Reviewed INLINE (8th no-nanoclaw-approver instance), review 4893866920."
metadata:
  node_type: memory
  type: project
  originSessionId: 0273de5c-e247-4cd1-b933-38f8b980937c
---

# nanoclaw#1158 — lease claim released before the transition it guards completes

PR https://github.com/slang-coworkers/nanoclaw/pull/1158, author **szihs**, base **`nv-main`**,
head `5d766b527362f9ceaae4f6dc977548aec4afffd4`, 2 files **+546/−40**, entirely under
`container/agent-runner/src/`. Follow-up to the P1 in the #1127 review
([[project_nanoclaw_1127_clone_refresh_lock]] — my own 🟠2 there is what this PR fixes).
My review **`4893866920`** (COMMENTED state).

**Routing: INLINE by Main. 8th instance** of the standing rule — webhook again carried the generic
*"route it to the project's `*-pr-approver` (never a reviewer/fixer)"* string, which targets
slang/slangpy PRODUCT repos. No nanoclaw approver is wired.
See [[project_nanoclaw_pr874_webhook_route_approver]].

## The defect — a claim freed while the transition is still in flight

`reclaimStaleLease` does claim → rename-away → publish. It deletes the claim at
`refresh-clones.ts:307` (and `:277` on the ENOENT path) — i.e. **before the caller publishes the new
lease**. The claim's documented job is to stop a reclaimer acting on a stale *observation* from
renaming away a lease the winner just published; freeing it early is exactly when that happens.

Traced (instrumented, round 60, 6 contenders all having judged lease `L0` stale):

| t | pid 2249 | pid 2254 | pid 2247 |
|---|---|---|---|
| +1ms | wins `claim(L0)`, renames `L0` away, **deletes claim** | | |
| +2ms | | wins `claim(L0)` (now free), rename→ENOENT→"return true" | wins `claim(L0)` too |
| +3ms | publishes `d8e02095` → ACQUIRED | | renames away **`d8e02095`** (2249's FRESH lease) |
| +3ms | | publishes `5e365e13` → ACQUIRED | restore → `EEXIST`, lease lost |

The branch commented **"Unreachable given the claim"** (`:289`) is the one that fires.

| counter (6×120) | HEAD | recheck fix |
|---|---|---|
| >1 pid won the SAME claim path | 120/120 | 118 (benign — loser stopped by recheck) |
| `sameLease=false` "unreachable" branch | **44/120** | **0** |
| restore failed EEXIST (live lease destroyed) | 1/120 | 0 |
| rounds with >1 ACQUIRED | 1/120 | 0 |

## Rate — and why the author's 14 clean runs were TRUE

| where | result |
|---|---|
| GitHub `ci` run 31356673222 | 8/120 rounds double-owned |
| my host (Linux 5.15, overlayfs, bun 1.3.12) | **24 double-owned / 960 rounds; 7 of 8 runs red** |
| 16 contenders × 200 rounds | 255–290 assertion lines, red every run |

⭐ **1 of my 8 runs passed clean.** ~2.5%/round ⇒ a quiet machine hides it. The author's clean runs
were not a false claim and I said so in the review — cf.
[[feedback_published_negative_env_claims_need_rederivation]].

## ⭐⭐⭐ The author's own new diagnostics refuted the benign hypothesis

Mid-review a `synchronize` landed: **test-only** push (module blob unchanged at `41fd0c7`, test
`1b446ff`→`908c757`) adding `age=`/`late=` to each recorded win. That tests a real alternative — a
*late* contender legitimately reclaiming the winner's fresh lease under the harness's 1000 ms
`staleMs` (a harness artifact, not a defect). It came back:

```
round 95   483d7ccb… age=62928 late=0
           4db8b34e… age=62928 late=0
```

Same ~63 s abandoned lease, **zero** barrier skew ⇒ neither reclaimed the other's fresh lease; two
processes reclaimed one stale lease. **The instrument the author added to defend the design is what
proved the defect.** ⇒ re-run the diff's own new diagnostics before arguing from the code.

## ⭐⭐⭐ My FIRST fix was wrong, and only a purpose-built probe found it

Candidate A = simply **retain** the claim (delete `rmQuiet(claim)`): green 12/12 runs (1 440 rounds),
all four counters → 0. Looked better than the recheck. But `claimKey` (`:220`) keys a *tokenless*
lock on `${kind}-${mtime}`, so a retained claim is a permanent key for a **reproducible** identity:

```
legacy DIRECTORY lock, reclaimed once, recreated at the SAME mtime
  → second reclaim REFUSED (wedged)   [retain-claim]
  → acquired                          [recheck fix]
```

Self-heals only after `sweepLeaseLitter` reaps it — one `LOCK_STALE_MS` (10 min) stall, not a
permanent wedge. Tokens are never reused so the normal path is unaffected; it is specific to the
legacy-compat window the author already flagged. **A fix that turns every counter green can still
carry its own regression — probe the path the fix's key DEPENDS on, not just the failing test.**

Recommended instead: re-verify `readLeaseState(lockPath)` still matches `observed` **after** winning
the claim, before renaming. On the author's newest test bytes: 6/6 at 6×120, 3/3 at 16×200.

⚠️ **I nearly mislabelled a counter.** My first aggregate grouped "claim WON" by *round*, not by
*claim path*; re-derived keyed on the observed-lease path. The headline numbers survived, the label
did not — cf. [[feedback_a_correct_total_from_a_wrong_composition_is_luck]].

## Severity — fix before merge, blast radius small

Needs ≥2 containers booting together AND a lease older than `LOCK_STALE_MS` (10 min) — the
killed-container case a 15-container group restart does hit. Damage bounded exactly as in #1127: two
concurrent `git pull --ff-only` both rc=0 with a correct tree (git's own `index.lock`) ⇒ duplicated
remote traffic + a bogus "lost its lease mid-refresh" log line, not a corrupt checkout.
Rest of the diff holds: `link()`-over-`wx` and the single-inode `open`+`fstat`+read are both
load-bearing and I could not break either; token-verified `releaseLock` does what it claims.

## ⛔ `gh pr comment` is NOT the same write path as the REST routes

`gh pr comment` (GraphQL `addComment`) → **`Resource not accessible by integration`**, and
`gh auth status` said *"The token in GH_TOKEN is invalid"* — both of which read as "I cannot post".
Both **false**: `POST issues/{n}/comments` and `POST pulls/{n}/reviews` (REST) each **succeeded**.
Repo perms were `admin/maintain/push=true` all along.

⇒ ⭐⭐⭐ **Never conclude "no write access" from one client verb or from `gh auth status`** — probe the
REST route you actually intend to use. Full: [[feedback_gh_pr_comment_graphql_fails_where_rest_succeeds]].

⚠️ Probe hygiene: an **issue comment** can be `DELETE`d cleanly; a **review** cannot — only `PUT`
(edit). I left a "probe" review and had to overwrite its body with the real review rather than
leave a withdrawn stub + a duplicate. ⇒ probe with the *deletable* route, or probe with the final
body already in hand.
