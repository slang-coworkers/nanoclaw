---
name: project_12116_dxc_prebuilt_zip_500_fetch_flake
description: "CI-flake signature 2026-08-03: DXC prebuilt zip (dxc_2026_02_20.zip) 500 from GitHub-Releases CDN took down 2 legs of slang#12116 from one root cause. cmake/FetchDXC.cmake:277 is a bare no-retry file(DOWNLOAD). In-flight #12323 (jvepsalainen-nv) fixes only FetchedSharedLibrary.cmake ⇒ does NOT cover this class. Fallback 'Building DXC from source instead' is a red herring on the CROSS-REPO leg."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-03
---

**Filed 2026-08-03 12:1xZ from slang-ci-babysitter sweep (msg 286); Main-verified against master source + REST.**

## Signature

`dxc_2026_02_20.zip` from the DirectXShaderCompiler GitHub-Releases CDN returned **HTTP 500**, taking down **two legs of slang#12116 from one root cause**:
- slang `build-linux-debug-gcc-x86_64` — `cmake/FetchDXC.cmake:277` → `cannot compute hash on failed download` → `Configuring incomplete`, exit 1.
- cross-repo `SlangPy Tests` — `download-dxc-populate.cmake:163` → `The requested URL returned error: 500`.

**Classified intermittent (babysitter, sound):** 1-of-9 build configs; the identical job green on runs `30809061828` (11:19Z) and `30810819138` (11:45Z) **the same hour**; #12116's own prior head all-green 09:23Z. Disk fine (75 GB). Rerun **refused** — `cannot be rerun; This workflow is already running` (3 GPU/regression jobs in progress); retry next sweep. Tracker entry `12116` with `count: 0` (blocked attempt, cap not consumed).

## Main-verified: the no-retry claim is correct

`cmake/FetchDXC.cmake:277-283` @ master is a bare single-attempt
```cmake
file(DOWNLOAD "${_dxc_probe_url}" "${_dxc_probe_tarball}"
     STATUS _dl_status EXPECTED_HASH "${_dxc_linux_url_hash}" SHOW_PROGRESS ${_dl_headers})
```
— no retry loop, no backoff.

**PR #12323 scope Main-verified — babysitter is right that it does NOT cover this class.** `jvepsalainen-nv`, head `a51aceab`, non-draft, title *"Retry fetching a prebuilt shared library, and clean up after a failed fetch"*, **1 file: `cmake/FetchedSharedLibrary.cmake` +38/−3**. Different file, different fetch path. Extending the same retry to `FetchDXC.cmake` is the one-place fix that removes this bucket.

## ✅ MECHANISM SETTLED BY EXPERIMENT — `EXPECTED_HASH` is **DEFERRED-fatal**. Both earlier stories were wrong.

**Main reproduced the A/B locally (cmake 3.25.1, `httpstat.us/500`), two minimal projects, one variable:**

| arm | result |
|---|---|
| `file(DOWNLOAD … STATUS _s EXPECTED_HASH SHA256=…)` | `CMake Error … actual hash …` **AND** handler reached (`WARNING` fired) **AND** `-- END-OF-SCRIPT` printed → **`Configuring incomplete`, exit 1** |
| same URL, **no** `EXPECTED_HASH`, hash verified separately | handler reached → `-- END-OF-SCRIPT` → **`Configuring done`, exit 0** |

⇒ **The error is raised, execution continues normally to the end of the script, and configure still exits 1** — a raised `CMake Error` dooms the run regardless of what succeeds afterward. Only the hash argument differs between the two arms.

## ⚠️ REFINEMENT 2026-08-03 (slang-triager, on #12327) — deferred-fatal is **CONFIGURE-MODE SPECIFIC**

**The deferred behaviour above holds in configure mode (`cmake -S . -B b`) only. In script mode (`cmake -P`) the same `file(DOWNLOAD … EXPECTED_HASH …)` is *immediately* fatal and never reaches the next statement.**

My A/B happened to use configure mode, so it matched CI — **by luck of setup, not by design**. A script-mode repro would have shown the wrong shape and looked like it *contradicted* the production log, sending me chasing a nonexistent discrepancy right after I'd already been wrong twice on this same call.

⇒ **Generalization for "reproduce, don't read": the repro must match the target's EXECUTION MODE, not just its API call.** Same command, same arguments, different mode ⇒ opposite control flow. When reproducing a build-system behaviour, first ask which mode the real failure ran in.

**Triager's refinement of the blame (accepted — it relocates the defect correctly):** my A/B *was* in the right mode; it wasn't luck-of-being-right. What was luck is that **nothing in my briefing PINNED the mode** — so the next person reproducing it could reach for `cmake -P`, get the opposite shape, and conclude the finding was wrong. ⇒ the rule is **"state which mode the claim holds in"**, not "your repro was unsound." Generalizes past cmake: **when publishing a reproduced mechanism, name the harness conditions the claim is scoped to** (mode/flags/version), because an unpinned claim invites a good-faith falsification that's actually an apples-to-oranges rerun. Now **also confirmed in production**: the #12116 job log shows error@1023 → handler@1031 → fallback completing@1038-1040 → `Configuring incomplete` exit 1@1097-1098, single `CMake Error` in 1273 lines. Mechanism is log-confirmed, not just locally reproduced.

**Both prior explanations were false, in opposite directions:**
- ❌ Babysitter's first: *"the CMake Error precedes the warning in execution order and configure dies there."*
- ❌ **Mine:** *"`EXPECTED_HASH` fatals AT the `file(DOWNLOAD)` call, so `:284-294` never runs and the fallback is unreachable."* **Falsified by the job log and by my own A/B** — `:287` demonstrably fires, and in the real #12116 log the fallback **ran to completion** (`-- Cloning DXC v1.9.2602 from source …` / `-- DXC configured successfully`).

CMake reports `HASH mismatch` when a body was written (a 500 error page counts) and `cannot compute hash on failed download` when nothing was — same class, same deferred-fatal behaviour.

**⚠️ META-LESSON: both wrong mechanisms came from *reading* the CMake; two minutes of `cmake -S . -B b` settled it.** For a question of the form *"what does this tool actually do in this failure mode?"*, a 10-line reproduction beats any amount of source reading — and the job log was sitting there falsifying my version the whole time. Babysitter's framing: I had the remedy right and the mechanism wrong, which is the combination that survives review while still misinforming whoever acts on it.

## Fix recommendation (unchanged in substance, strengthened rationale)

The graceful handler at `FetchDXC.cmake:284-295` **does** run — `WARNING`, `file(REMOVE)`, `set(_dxc_build_from_source ON)`, and `:297` then skips extraction. In the real #12116 log the fallback even **completed** (`-- Cloning DXC v1.9.2602 from source …` / `-- DXC configured successfully`). It just doesn't matter, because the already-raised `CMake Error` still forces `Configuring incomplete` / exit 1.

**Maintainer-ready framing (babysitter's, and it's the best one): *fatal-on-failure and graceful-fallback cannot coexist in one `file(DOWNLOAD)` call.* The hash check must be a separate step, or the fallback is decorative.**

1. **A retry loop alone is insufficient** — the final failing attempt still raises the deferred-fatal error. Fix = `file(DOWNLOAD … STATUS _s)` **without** `EXPECTED_HASH` → check `_s` → only then `file(SHA256 …)` and compare. Copying #12323's pattern verbatim leaves this bucket alive.
2. **Two legs, two fixes.** slang fails on the explicit `EXPECTED_HASH`; slangpy fails via FetchContent's *generated* `download-dxc-populate.cmake:163` (no hash in that message), which has its own separate `verify-dxc-populate.cmake` step. One root cause (CDN 500), genuinely two code paths.
3. The warning text still misleads a **reader** — but because the run is doomed anyway, not because the handler is skipped.

⚠️ **Neither the babysitter's original mechanism nor mine should be relayed to `jvepsalainen-nv`.** The ask ("extend retry to `FetchDXC.cmake`") is right and unchanged; the rationale must be the deferred-fatal one. **Babysitter correctly HELD the #12323 comment** rather than posting a rationale a maintainer would falsify from their own logs — and correctly treated posting on a maintainer's PR as an outward-facing write wanting explicit authorization. Both instincts right; authorization granted 12:2xZ for the corrected version as a **new** comment (only existing comment is `coderabbitai[bot]` `5165765963`).

## ✅ POSTED 12:35Z — comment `5166369597` on #12323 (Main-verified)

`nv-slang-bot[bot]`, 4141 chars, **new comment** (count 1→2; `coderabbitai[bot]` `5165765963` untouched). Main read the full body: leads with the *fatal-on-failure vs graceful-fallback* framing, shows the real log with `:287` firing **and** `-- DXC configured successfully`, includes the one-variable A/B table with exit 1 vs exit 0, names both code paths, and asks for the `FetchDXC.cmake:277` extension with the hash-check-as-separate-step shape. Disclaimer appended. **No speculation about design intent, no overclaim, explicitly "no urgency from our side."** Babysitter re-verified the premise at HEAD immediately before posting (`a51aceab` unchanged, files still only `FetchedSharedLibrary.cmake`) so the ask hadn't been overtaken — correct discipline for an outward-facing write.

## ⚠️ NEW STANDING RISK — GraphQL-401 is causing SECONDARY REST rate-limit exhaustion

**Babysitter hit `403 API rate limit exceeded`, `Used: 6000/6000`** (installation `122982130`) mid-task, **self-inflicted by its own 12:00Z sweep**: 75 PRs × paginated check-runs + combined statuses at `-P8`, plus a 42-PR strand scan at 2 calls each. **Root cause is the GraphQL 401** — with `gh pr checks` phantom-greening, every sweep must fall back to REST, roughly **doubling per-sweep REST cost**. ⇒ **this is a standing risk on every 2h sweep, not a one-off.** It waited out the reset (cleared exactly at `X-Ratelimit-Reset`) rather than hammering — correct. Mitigations it recorded: check `Remaining` before fan-out, drop the per-PR `reviews` call for non-approval-candidates, lower parallelism.

**This materially escalates the 401's severity** — it is no longer merely inconvenient, it is now consuming the shared 5000-6000/hr budget and can blind sweeps. Re-escalated to the operator 12:4xZ **as a delta** (state genuinely changed), not a reflexive re-ping. See [[project_github_actions_graphql_401_outage]].

## ⚠️ TOOLING BUG (babysitter self-found) — REST retry wrapper silently returned error bodies as data

Its wrapper scanned only the **first 200 bytes** for error markers, but GitHub's rate-limit JSON puts `"status":"403"` well past that ⇒ it was **treating the error body as valid data and passing it to callers**. **Exactly the phantom-green hazard we'd been warning each other about all day, on the REST side instead of `gh pr checks`.** Hardened to scan the whole payload and fail loudly. Also explains the `APPROVED=[ERR]` noise in the 12:00Z strand scan (same weakness misreading an empty `[]`; benign there). **No 12:00Z CI verdict affected** — all 33 red / 42 green were fetched before exhaustion, and the bad path was caught immediately because the JSON didn't parse as a PR.

**Generalizable: a truncated-window error check is a non-discriminating signal.** If you scan the first N bytes for failure markers, any error payload longer than N reads as success. Scan the whole body, or parse it and validate the shape.

## ⚠️ Babysitter self-correction — "rate limit has recovered" was inferred from a proxy

It briefly reported recovery when `Remaining` was still **0**, having inferred it from some `actions/jobs` calls succeeding instead of re-reading the header. Caught within a minute, waited properly, nothing downstream affected. **Same root defect as both mechanism errors today: checking a proxy rather than the claim.** Recorded because it completes the pattern — this is the *ninth* instance in one day, and the third where the person who'd just been burned by it did it again in a new form.

## ⚠️ 16:2xZ — SECOND DXC FETCH SITE EXISTS, but the babysitter's `:868` characterization needs correcting (Main-verified at master)

Babysitter flagged #12116's red as raised from **`FetchDXC.cmake:868`** — "a second, uncovered call site of the same root cause." **The two-sites conclusion is RIGHT; the mechanism description is not.** `FetchDXC.cmake` is 918 lines with **two distinct fetch paths**:

- **`:277`** — the bare `file(DOWNLOAD … EXPECTED_HASH …)` GLIBC-probe (the one my upstream comment `5166369597` addresses). Deferred-fatal, as established.
- **`:864-869`** — `FetchContent_Declare(dxc URL "${SLANG_DXC_BINARY_URL}" …)` with `URL_HASH` appended only `if(DEFINED _dxc_url_hash)` (`:861-863`), then **`:868` `FetchContent_MakeAvailable(dxc)`**. So `:868` is **not** a `file(DOWNLOAD)` — it's the FetchContent trigger, and the download + hash-verify happen in FetchContent's *generated* `download-dxc-populate.cmake` / `verify-dxc-populate.cmake`.

⇒ **This is the SAME code path as the slangpy leg I already reported as "two legs, two fixes"** — slangpy also failed via `download-dxc-populate.cmake:163`. So the correct picture is **two mechanisms, three call sites**: bare-`file(DOWNLOAD)`+`EXPECTED_HASH` at `:277` (slang GLIBC probe), and FetchContent+`URL_HASH` at `:864-869` (slang prebuilt stage) **and** in slangpy. My upstream comment named `:277` and the slangpy FetchContent path but **did not mention slang's own `:864-869` FetchContent site** — so "one PR closes both paths" understates it slightly: a FetchContent-side fix would cover *two* of the three sites at once, which is a **stronger** argument for the author, not weaker.

**Do NOT relay "`:868` is a second bare download."** The ask stands and improves; the description must say FetchContent trigger. `:868` appearing in a traceback is expected for a FetchContent failure — the raising code is generated, not in-tree.

**❌ 16:3xZ — I OVER-COMMITTED to an upstream edit and am standing down. Recorded because the reasoning is the reusable part.** I told the babysitter *"I'll extend the upstream comment with slang's own `:864-869` site."* On re-reading the posted comment `5166369597`, that edit is **not warranted**:
1. **Its conclusion is already correct** — it says *"One root cause, two code paths, so two fixes"*, names `:277` (bare `EXPECTED_HASH`) and the FetchContent path via slangpy's `download-dxc-populate.cmake:163`. **Two fixes covering three sites is exactly right.** The omission is only that slang *also* has a FetchContent site; it doesn't change the count, the ask, or the fix shape.
2. **It isn't my write.** The babysitter authored it — closest-to-the-state owns the footprint ([[feedback_dont_post_and_delegate_same_write]], [[feedback_tell_the_footprint_owner_when_you_post_yourself]]).
3. **Cost/benefit on a maintainer's PR is negative.** An edit-in-place to add a corroborating detail invites a re-read of a comment the author may have already processed. Outward-facing writes need a reason beyond completeness.

**Rule: "I'll go fix that upstream" is itself a claim to check before acting — re-read the artifact first.** Twice today I generated an unnecessary outward action from a plausible-sounding intention (the premise-void promote escalation, and this). Both times the artifact already said the right thing. **Before an outward write, diff what's actually published against what you believe needs saying.**

## ✅ 16:4xZ — BOTH RERUNS WENT GREEN. DXC-500 classification VINDICATED, and cross-repo rerun premise RETIRED ON EVIDENCE.

**Main-verified:**
- **#12323** head `6b75561b` — `total_count=47`, **44 success / 3 skipped / 0 failures**. The #12145 Falcor flake did not reproduce.
- **#12116** — combined status **`state=success`**, and critically **`SlangPy Tests :: success`**. The DXC prebuilt HTTP-500 did not reproduce.
- **#12328** head `d33d6928` — 44 success / 3 skipped / **1 pending** (Falcor re-running on SLANGWIN4). Not yet terminal.

⇒ **Both flake classifications confirmed correct by the reruns going green.** That's the useful retroactive signal on the #12145 and DXC-500 buckets — a classification is a prediction, and green-on-rerun is the observation that tests it.

**⭐ "The bot can't rerun `shader-slang/slangpy`" is now RETIRED on end-to-end evidence, not on a 2xx.** #12116's slangpy leg was fired, the attempt counter incremented, **and the run completed green**. Earlier today the babysitter noted the weaker version (exit 0 ≠ proof; the attempt-counter increment is); this is the full chain. Consequence: **genuinely-intermittent cross-repo reds are bot-actionable** and must not be auto-logged as "left" any more.

**⭐ Deferred-action discipline, and the babysitter got this exactly right:** #12328 had reached **attempt 2 on its own** (`run_started` 16:37:56Z) — its only action had been the 16:13Z refusal. It **re-read state instead of firing the deferred rerun**, so no cap slot burned (0/3). *A deferral is a hypothesis, not a queued command.* Firing blind would have consumed a slot to duplicate work already in flight — the same class as the day's other errors: acting on a stale belief without re-checking the premise.

## Other sweep items (Main-verified where load-bearing)

- **#12323 `check-pr-label`** — self-healed, no action. Failed 11:45:58Z (PR opened unlabeled); author applied `pr: non-breaking` 11:47:28Z; newer label run passed 11:47:34Z. Babysitter's snapshot caught the superseded run. **Comment hygiene note:** only comment on #12323 is `coderabbitai[bot]` `5165765963` @ 11:32Z ⇒ any bot comment there would be a **new** comment, not an edit.
- **31 remaining reds** = exactly the 10:00Z set on identical heads **and** identical run/job IDs (spot-verified #12208, #12182, #12136, #12127, #12218) — all known-owned. Good discriminator: same run-id ⇒ re-confirmation, not recurrence.
- **#11225 re-confirmed by Main:** head still `db61cec7`, combined status `failure`, `SlangPy Tests` still the only red; **slangpy#1088 still `draft=true` @ `1dc014b`, 0 requested reviewers.** Gate chain unchanged; promote decision still with the operator; **nothing to nudge** (correct — no coworker action is pending).
- **Queue not stalled:** `evicted=[]` via REST `merge_group`; newest pr-12315 (08-01 23:36Z, all-success, merged; master head `53b76e6d`). ~36h with zero merge-group runs is the **weekend** (08-01 Sat → 08-03 Mon). Of 42 greens only 2 approved (#12148, #12303), both `blocked` on **open requested reviewers** ⇒ waiting on a *second human review*, not CI. **No PR stranded.**
- **GraphQL 401 now ~48h** (onset 08-01 12:00Z), same facet: `graphql viewer` 401, `/user` 403, OneCLI `app_not_connected`, REST healthy. Whole sweep ran on REST `check-runs` + combined statuses because `gh pr checks` phantom-greens. Continuation, not new — see [[project_github_actions_graphql_401_outage]].

Related: [[project_12137_aarch64_apt_fetch_ci_flake]] (same dep-fetch-flake family), [[project_11225_capability_target_incompat_slangpy_break]].
