---
name: project_12418_test_server_rpc_ci_bucket
description: "slang#12418 (our bot's filing) — test-server JSON-RPC reds Windows-GPU test-slang. OPEN. Audited 08-07: timeout mechanism REFUTED (EOF, not deadline), buckets recounted by terminal failure. Corrections published. CLOSED both sides."
metadata:
  node_type: memory
  type: project
  originSessionId: 961e1d9a-3aa4-460c-ad2d-350e2764078f
---

# slang#12418 — test-server JSON-RPC CI bucket (our own filing, audited)

**OPEN**, label `CI Stability`, author `nv-slang-bot[bot]`, filed **2026-08-07T02:42:38Z** by
`slang-ci-babysitter` (session `sess-1786065849548-9kwfio`, thread `gh-issue-shader-slang/slang-12388`).
Spun out of [[project_12388_windows_gpu_vulkan_device_loss]] at that issue's own request.
**Chain CLOSED both sides 2026-08-07 ~04:32Z.** Corrections published; nothing outstanding.

## Why audited: third artifact in a 2-day pattern
#12341 and #12388 both shipped artifacts whose *in-chain* verification missed defects. Same coworker,
same artifact class, three consecutive days. ⛔**"The chain closed cleanly" is not "the artifact is sound."**

## The load-bearing finding — the central mechanism was REFUTED at source
Issue's headline hypothesis was an **RPC timeout**, and it claimed the deadline was un-quotable
(*"no log emits a `timeout` string, so the deadline is inferred"*). A named deadline exists in-tree
(verified at upstream master via the contents API, not a local clone — the local clone is **shallow**,
21 commits, so `git log -S` blame there is worthless):
- `tools/slang-test/test-context.h:178` — default `connectionTimeOutInMs = 120 * 1000`
- `tools/slang-test/test-context.cpp:31-33` — **Windows + `_DEBUG` → `1000*60*5` = 300s**
- consumed at `slang-test-main.cpp:1191`; `SLANG_TEST_RPC_TIMEOUT_MS` override **set nowhere in `.github/`**
- provenance: PR **#10993** (jkiviluoto-nv, merged 2026-04-30) raised Windows debug 120→300s for this symptom

⭐⭐**The deadline INVERTS the issue's own skew argument.** It inferred a timeout from debug (10.3%) >
release (3.5%) "because debug is slower per operation" — but **debug's deadline is 2.5× LARGER**. A
deadline-crossing model predicts *release* skews worse. Measured debug waits topped out at **83.7s** vs
300s; the one release job that came close was **113.4s vs 120s**.

⭐⭐⭐**The positive cause (found by the peer, stronger than my argument):** `slang-http.cpp` — `isEnd()`
while in `ReadState::Content` at **264** → `ReadState::Error` + `m_readResult=SLANG_FAIL` at **273-274** →
`return SLANG_OK` at **276** → `while` at **360** fails → `return m_readResult` at **395**. The clock check
at **372 is never reached.** ⇒ **EOF — the child was already gone.** So a `waitForResult()` in a log is
**NOT** evidence a deadline was consulted. ⚠️Both of us mis-cited this passage once (I said 366, they said
381; `SLANG_RETURN_ON_FAIL(update())` is at **364** and is **not on this path**).

Also: `slang-test-main.cpp:1191-1206` — `waitForResult()` logs but does **not return**, so control always
falls through to `!hasMessage()`. **One event, not two** — my variant tally double-counted (the tell was
that the two counts were *always exactly equal*: 4/4, 4/4, 3/3, 8/8).

## ⛔ The rpc-confound (peer's catch, and it landed on ME)
They counted **RPC-string presence, not RPC-caused reds**. I then fed them two jobs (`91750175993`,
`91766305884`) as RPC evidence selected the same wrong way: terminal `FAILED test:` on **both** is
`tests/cuda/cuda-forward-uniform-signature-preserved-callee.slang.1 (cuda)` — an **nvrtc codegen
regression** (`error : identifier "Slang_FuncType" is undefined`), and their lone `sendCall()` blip was on a
different test that **retried and passed**. Reclassified by terminal failure, the **18 reproduced exactly —
by coincidence**: string-presence over-counted by ~11 while window/denominator errors under-counted by about
as much. ⭐⭐⭐**A number that defends itself while its composition is wrong.**

## Corrections published (their comments, closest-to-the-state)
`cancelled 57→63` (57 was the 4-day RPC window written into a full-window sentence) · `den 270→264` ·
`11.9%→11.8%` **as-of-stamped** (den 160→161 was a *clock artifact*: job `92736774784` was `in_progress` at
their 01:42 snapshot, correctly excluded, and has since completed `success` — **11.9% was correct when
written**) · `#11752→#11753` (#11752 is **closed, merged=false, still draft**; the fix landed as #11753,
jkwak-work, `36fd25bf7a04`) · #10985 `CONFLICTING` · #12146→**#12114** as *mechanism precedent only*
(#12114's own body disclaims being the flake fix) · 15,289 relabelled "raw job rows" with scope ·
**~9× suite-divergence discriminator DROPPED as contaminated** (two device-loss jobs took
`Too many failed tests for retry(110)`, promoting every pending test to terminal ⇒ 111 and 89 failures from
two jobs).

⭐⭐⭐**RANKING-UNIT finding (theirs, the most consequential):** device loss = **2 jobs / ~200 terminal test
failures**; RPC = **18 jobs / ~24**. Ranking by *jobs* says RPC 9×; by *tests red* says device loss ~8×.
#12388's correction (and my relay of it) asserted the first **without naming the unit**. Also
`92523374425` ran on **`win-test-9ce29415`** — the exact runner in #12388's title whose host premise was
withdrawn; the nonce finding (782 names/782 executions) still holds, so this is *not* a retraction, and it
was published with **both readings** stated.

## Perishability — two fields with retention horizons
- **`steps[]` is zeroed at ~7d** while `status`/`conclusion` persist. "`steps==0` ⇒ never executed ⇒
  UNTESTED" silently reclassifies **real aging failures** as untested ⇒ a windowed flake rate **drifts
  downward as the window ages** with no fleet change. Inaction-biased. The 63-cancelled `54/9` split is
  **not reconstructible after the fact** ⇒ dropped entirely; #12388 corrected to the `conclusion`-based 63.
- **Log-derived classification expires the same way** (7 of the class failures already had HTTP-410 logs at
  filing). ⇒ 29 per-job verdicts persisted to `winsweep-0807/terminal-classification-2026-08-07.json`,
  dated and marked non-re-derivable. ⭐**Store the derived bucket, not the raw row.**

## Final defect tally across both parties: 5 mechanisms (2 theirs, 3 mine), 7 figures (4 theirs, 3 mine)
⭐⭐⭐**Single-party verification passed on every one of the 12.** Every correction came from the *other*
party's instrument disagreeing. The **pair** was reliable; neither agent was. Full method, the reproduced
root cause of my own fetcher bug, and the detector class:
[[feedback_a_mechanism_you_cannot_reproduce_is_a_story]].

## ⚠️ WHAT REMAINS UNRESOLVED — a mechanism was REFUTED, not established
The 18 are now correctly *composed*, and the failure is EOF-on-a-dead-child rather than a deadline. But
**why the test-server child dies is still unidentified**: no exception, no access violation, no `0xC000....`,
no non-zero test-server exit in any log examined (only the harness's own `exit code 1`). ⛔**Do not let
"timeout refuted" read as "cause found."** ⇒ **Ask #2 on the issue is now the load-bearing one** — emit the
child's exit state + elapsed time on RPC failure (also proposed in #10985), which converts this from
inference to measurement. That is a maintainer's call. Note `-server-count 8` (shared pool) means one dead
server reds several unrelated tests in a cluster, so the natural unit of count is the **cluster**, not the
test. Precedent for a crashing child: #12146 → **#12114** (LLVMBuilder JIT-teardown use-after-free).

## RESUME
- Any fresh substantive **human** comment on #12418 / #12388 / #10985 re-opens the chain regardless of the
  closed state above.
- **#10985** was pinged for revival (jkiviluoto-nv); the revival condition holds (RPC failures did resurface)
  but the mechanism attached to the ping was corrected. Watch for the author splitting the durable
  `Process::create` handle-inheritance fix (`source/core/windows/slang-win-process.cpp` +78/-9) from the
  temporary stress instrumentation. Branch `jk/windows-rpc-diagnostics` is **CONFLICTING/DIRTY**.
- **#11911 is open with its fix #11913 still unmerged** — bears on how these RPC reds are counted.
- If the RPC count is ever re-derived, note the classification is **not re-runnable** (logs aged out); use
  the persisted JSON.
