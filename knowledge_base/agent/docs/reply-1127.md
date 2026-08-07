Reviewed inline (no nanoclaw approver is wired; the `pr_ready_for_review` webhook's `*-pr-approver` string targets the product repos). ⚠️ **This merged at 14:04:45Z while I was mid-review** — everything below is follow-up material, not a merge gate.

I closed the gap you named: I ran **both defects against a real remote with a real submodule**, and the central claim reproduces exactly. Three findings, all from execution.

## Corroborated — the real-git run you said you could not do

Fixture: real upstream, real clone, upstream advances `f.txt` *and* adds a submodule whose `.gitmodules` URL does not resolve, so `pull --ff-only` genuinely succeeds and `submodule update --init` genuinely fails. Same fixture, `base` vs `head`:

| | boot 1 | disk after boot 1 | boot 2 (**+1 s**, deep inside the TTL) |
|---|---|---|---|
| **base** (`e81a0cc`) | logs `Clone refresh skipped` | `head=32b5d02 f=v2` — **advanced**, `sub/x.txt` **MISSING** | `refreshed=[] log=[]` — **SKIPPED** |
| **head** (`5c4d3ca`) | logs `submodule update FAILED … partially refreshed … (not stamped)` | identical partial state | attempts `["pull","submodule"]` — **RETRIED** |

So the masking is real, the log line really did say the opposite of what happened, and the new stamp really does fix it. `FETCH_HEAD=true / our-stamp=false` after the partial boot is the whole bug and the whole fix in one line of output.

Two more of your claims verified rather than assumed:

- **`Bun.YAML` attribution is exactly right.** On bun **1.3.12** (what CI pins) `src/memory/scaffold.test.ts` is **4 pass / 0 fail**. Your 1.2.19 diagnosis holds.
- **Typecheck is clean** — but note a bare worktree yields a *false* `TS2688: Cannot find type definition file for 'bun'`; it only inspects the file once `node_modules` is present. Your planted-error control was the right instinct.
- **Unasked, and it passes:** git tolerates our artifacts living in `.git` — with both the lock dir and the stamp present, `fsck`, `gc`, and `status --porcelain` are all clean, so the stamp never shows up as untracked and `gc` doesn't reap the lock.

## 🟠 1 — the mechanism you call "the part that actually fixes defect 1" is the one thing the tests don't pin

I deleted each guard and re-ran the 19 tests:

| mutation | result |
|---|---|
| **remove the in-lock re-check** | **19 pass / 0 fail** |
| **remove the outer pre-check** | **19 pass / 0 fail** |
| remove lock acquisition | 18 / 1 fail |
| stamp despite submodule failure | 17 / 2 fail |
| stamp despite pull failure | 18 / 1 fail |
| stale-break: drop age check | 16 / 3 fail |
| `releaseLock` → no-op | 16 / 3 fail |

Every guard is pinned except **both recency checks**. And the concurrency test doesn't reach the re-check — I instrumented which branch excludes the nine contenders:

```
pulls=1   excluded-by-LOCK=9   excluded-by-RE-CHECK=0
```

The nine are refused because boot 1 still *holds* the lock (it re-enters mid-pull), so they never get inside it. The re-check's actual window is different: B passes the pre-check → A completes and **releases** → B *acquires* → re-check sees the fresh stamp. Nothing exercises that ordering.

This is a test gap, not a code defect — the re-check is correct and load-bearing in production. But the test presented as proving it would pass without it, so it isn't protected against a future refactor. A direct test would assert the `while we waited` log line specifically.

## 🟠 2 — the stale-lock break is itself check-then-act, the pattern this PR exists to remove

`acquireLock` on the break path is `stat` (judge stale) → `rmSync` → `mkdirSync`. Two boots that both judge the same orphan stale can both pass the age test, and the loser's `rmSync` then **deletes the winner's live lock** — after which a third boot walks in while the winner is mid-pull.

**Honest severity, because I tried to make it fire and could not.** 15 real processes against a genuinely 11-minute-old orphan, gate-synchronised, real `Date.now()`, 8 trials = **120 boots, exactly 1 winner every time**. Then 40 boots × 3 trials with the branch instrumented: **the BREAK path is entered by exactly 1 boot per trial** (39 refused). The window between `rmSync` and `mkdirSync` is sub-millisecond and nothing landed in it.

Damage is also bounded: I ran two concurrent `git pull --ff-only` on one clone — both `rc=0`, tree correct — because git holds its own `index.lock`. So the worst case is duplicated remote traffic, not corruption.

Latent, not urgent. If you want it airtight, `mkdir` a uniquely-named dir and `rename` it into place (atomic replace, no gap), or write the pid in and re-read to confirm ownership after breaking.

⚠️ **One caution about my own instrument, since it's the trap you already documented in the test file:** an in-process probe with an *injected* `nowMs` shows both callers acquiring — but that's the injected-clock-vs-real-mtime artifact, not a real race. The 120-boot real-clock run is the trustworthy number. Your comment at `refresh-clones.test.ts:79-83` is exactly the reason I re-ran it that way.

## 🟡 3 — `releaseLock` swallows its failure, so a 10-minute refresh outage is silent

If `.git` becomes unwritable between acquiring and releasing, `releaseLock`'s bare `catch` drops the error and the lock **leaks**. Measured: lock present after the run, **no log line mentioning it**, next boot `pulls=0` (blocked), and it only recovers once the leaked lock ages past `LOCK_STALE_MS`:

```
lock LEAKED after the run: true    release warning in log? false
next boot pulls=0 (blocked)    after LOCK_STALE_MS pulls=1 (self-heals)
```

Contrived trigger and it does self-heal, so 🟡 — but the comment says *"a stale lock is broken by the next boot"* when it's actually broken 10 minutes later, and the operator gets nothing to correlate against. A one-line `log()` in that catch would cost nothing.

*(Isolation note: this leak is also what produced a `pulls=0` in an earlier probe of mine that looked like a stamp-mask regression. It wasn't — the stamp logic is fine. And a directory-shaped stamp does **not** suppress refreshes forever, as I first suspected: mtime still ages out, so a year later it refreshes normally.)*

## Suite attribution — your "1 fail" is stale, but the PR adds nothing

Your figures were taken at `e81a0cc`; `nv-main` has since moved to `71c24beb`. Merged onto current tip (clean merge, no conflicts):

| tree | result |
|---|---|
| `nv-main` **alone** | 355 pass / 1 skip / **3 fail** |
| `nv-main` **+ this PR** | 367 pass / 1 skip / **3 fail** |

Same three, all `poll-loop.test.ts` › *critique-gate text-output integration (#67)* — **pre-existing on `nv-main`, none attributable to you**, and `refresh-clones.test.ts` is 19/19 on the merged tree. Worth flagging separately that `nv-main` currently carries three genuine failures unrelated to this change.

One structural note on the differential you cited: head tests against base source can't run at all — it's a **compile** failure (`Export named 'REFRESH_LOCK' not found`), not 7-vs-19 behaviour. That's why the real-git run above matters; it's the only thing that actually demonstrates base-fails / head-passes for the shared logic.

---

Net: the diagnosis is right, the fix is right, and the two defects are independent exactly as you argued. The stamp-vs-`FETCH_HEAD` separation is the correct call — ownership of the completion signal belongs to the code that knows what "complete" means. Follow-ups worth a small PR: a test that reaches the re-check, the atomic `rename` on the break path, and a log line in `releaseLock`.
