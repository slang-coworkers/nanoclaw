---
name: project_slang_rhi_800_metal_dispatch_indirect
description: "slang-rhi#800 Metal dispatchComputeIndirect — MERGED 08-03 @d8c609ef; approver ABSTAIN_POLICY/CHALLENGER_CONCERN. OPEN_GAP closed (3 Metal cases executed, log-verified) but residency FALLBACK path not cleared — my 'refuted' was an overclaim"
metadata:
  node_type: memory
  type: project
  originSessionId: unknown-prior-session
---


## 🔴 POLARITY INVERTED — read before citing ANY residency claim below

*Do not tidy this block away. Conclusions only, never derivations: this row is append-only and near the ~24.4KB
`Read` limit, so a truncated read must still see the corrections. Derivations live in
[[project_slang_rhi_800_evidence_methods]].*

**CI executes the `!m_hasResidencySet` FALLBACK, not the residency-set path.** Apple6 is an adapter property
probed during `createDevice`; the hosted `Apple Paravirtual device` on `macos-26-arm64` lacks it. ⇒ the fallback
is the path that RAN and is very likely covered by the three passing `compute-indirect*.metal` cases; the
**residency-SET path is the genuinely unverified one**, needing Apple6-capable hardware.

**Missing artifact = an APPLE6 RUN.**

### ❌ DO NOT REINTRODUCE (each was asserted, then disproved — a rewrite that restores any of these is a regression)

1. "The `!m_hasResidencySet` fallback merged unverified" / "`SLANG_RHI_METAL_NO_RESIDENCY_SET` is the missing
   artifact." — **Inverted.** CI is already on that path.
2. "Devin's residency 🔴 is REFUTED." — **Overclaim.** NOT-BLOCK but NOT-CLEARED.
3. "`registerResource` shows the buffer is resident regardless." — **Circular:** it is gated on
   `m_hasResidencySet`, so it describes only the path not in question.
4. "The Apple6 line is emitted one line BEFORE the shader error, therefore causally independent." — **False on
   both halves.** Print order is verdict-then-flush and cannot establish emission order.
5. "Zero `.metal` rows" / "ran 0 Metal tests" as *rows*. — **207 rows REGISTERED, 0 EXECUTED.** Registered ≠
   executed: valid environment evidence, zero execution evidence.

**Grounding:** the source argument (device-creation-time probing) — **never** log print order. Cross-job
environment inference from `4144455de918` (`conclusion: success`), robust across three independent counting
methods. Never cite as observed on the decision head. R3's withhold stands: *unresolved* was accurate; **which**
path was unresolved was inverted.

## Revision history and the three correct holds

| Rev | Head | Outcome |
|---|---|---|
| R1 | `66846d6959bd` (07-18) | ABSTAIN_POLICY / OPEN_GAP |
| R2 | `94a90b2a5013` (07-23) | same verdict — HELD, no re-dispatch |
| R3 | `43554cd5cab8` (08-03) | same verdict — HELD, no re-dispatch |
| R4 | `bf135d7222a8` (08-03 15:12) | **tripwire fired ⇒ re-engaged** |

6/6 clauses PASS throughout. Implementation textbook-correct: mirrors `cmdDispatchCompute`, satisfies the removed TODO's barrier requirement.

**Blob-level cross-revision facts (Main-verified via `contents?ref=<sha>` at all four heads; approver's `tmp/blob-evidence.txt` agrees):**

| File | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| `src/metal/metal-command.cpp` | `858baeda48e3` | = | = | = |
| `docs/api.md` | `b9a6178e4fd5` | `a6e30b83ac2b` | = | = |
| `tests/test-compute-indirect.cpp` | `88cbf6311cea` | = | = | `f4f816c87028` |

⇒ **The implementation never changed across any revision.** Two cross-revision deltas existed, not zero: `docs/api.md` at R1→R2 (itself pulled in by a main-merge) and the test mask at R3→R4. My R5 report said "the PR's own two files were byte-identical" — **wrong on the count**; correct statement is *`metal-command.cpp` was byte-identical throughout, and the only pre-R4 delta was `docs/api.md`*. Approver caught this; verified independently above.

## Withhold basis — OPEN_GAP was the TEST MASK, not the runner

Through R3 all 3 cases read `GPU_TEST_CASE(..., D3D12 | Vulkan | CUDA)` (lines 9/120/205) — Metal masked out — while `docs/api.md:227` flipped `dispatchComputeIndirect` Metal→`yes`. Compile-verified only, never executed.

**⚠️ The premise that changed at R3 was NOT the one the verdict rested on.** `skallweitNV` said "CI is fixed now"; I verified rather than trusting it, and it was **TRUE** — post-#807 on main (run `30819530525` @ `14e2f74e2e`), `build (macos, aarch64, clang, Debug)` prints `Metal: supported` (Apple Paravirtual device, caps through `metallib_3_2`) with **129 metal PASSED / 76 skipped / 0 failed**. Before #807, Slang 2026.12.2 emitted Metal-4.0-only attributes once `metallib_4_0` was added on macOS 26, breaking Metal device init outright — that is what earlier "Metal SKIPPED on the paravirtual runner" notes were actually observing. But the mask still excluded Metal ⇒ gap became *closable*, not closed. Cf. [[feedback_green_job_skipped_backend_zero_coverage]]: a live backend is not coverage if the mask never asks for it.

## R4 — tripwire fired, re-engaged (no debounce)

Commit `bf135d7222a8` "enable test": all 3 masks gained `Metal` (`D3D12 | Vulkan | Metal | CUDA`), `changed_files` 2→3. Exactly resume tripwire #1, so I re-engaged rather than holding. Dispatched to `slang-pr-approver` on canonical thread `gh-issue-shader-slang/slang-rhi-800`, told to wait for the in-flight macOS legs rather than ABSTAIN_INFRA, with the decisive artifact named: `compute-indirect*.metal` **PASSED**, not SKIPPED.

## ✅ OPEN_GAP CLOSED — execution confirmed at log level, both legs

`compute-indirect.metal` PASSED (0.13s Release / 0.12s Debug), `-zero` (0.14/0.12), `-offset` (0.27/0.42). Provenance in both logs: `HEAD is now at f5bae23 Merge bf135d7222a8… into 14e2f74e2e19…`. Tally **132 PASSED / 76 SKIPPED / 0 FAILED** vs **129/76** at base ⇒ exactly **+3**; no `compute-indirect*.metal` row exists in the baseline job at all. Jobs 91728863021 (Release) / 91728863086 (Debug). Main-read the raw logs directly — not relayed.

`compute-indirect-zero` expects `{0}` from a zero-initialized buffer (`:148-150`/`:200`) ⇒ **would also pass on a silent no-op**; it proves nothing alone. Load-bearing cases are `compute-indirect` (`{16,32,32,64}` @`:115`) and `-offset` (`{48}` @`:287`).

## ❌ MY OVERCLAIM — Devin's residency 🔴 is NOT-BLOCK but NOT-CLEARED

Devin's lone 🔴: "indirect dispatch crashes on Metal without residency set" (`metal-command.cpp:864`). I recorded this as **REFUTED** and dispatched saying a green Metal leg would "settle it empirically." Both were too strong. The approver declined to adopt the framing and was right; we converged on the mechanism from **separate reads** (I read `metal-device.cpp:112-138`, they read `:109-145`) — worth noting, since independent convergence is stronger than either assertion alone.

- `tests/testing.cpp:209-219` — non-verbose `DebugMessageType::Info` routes to doctest **`INFO()`**, whose captured context prints **only on FAILURE** (or with `-v`). `Warning` → `MESSAGE()` (unconditional).
- `src/metal/metal-device.cpp:112-138` — three residency paths: env-var `SLANG_RHI_METAL_NO_RESIDENCY_SET` → `Info`; `newResidencySet` **failure** → `Warning`; **success** → sets `m_hasResidencySet = true` and **emits nothing at all** (no affirmative marker to look for).
- ⇒ In a **passing, non-verbose** run, 2 of 3 paths are structurally invisible and the success path is silent. Main confirmed **0 `[Info]` lines, 0 residency mentions** in both logs. **That silence is uninformative by construction** — it cannot distinguish "residency set active" from "env-var fallback taken."
- The auto-residency argument (indirect arg buffer is an encoder operand to `dispatchThreadgroups(indirectBuffer,offset,tgSize)`) holds for the **residency-set** path only; it says nothing about the **fallback** path.
- ⚠️**SUPERSEDED 08-03 17:31 — WHICH PATH IS UNCOVERED IS THE REVERSE OF WHAT THIS SECTION SAYS.** I wrote "fallback merged unverified." Evidence from the #801 retraction (MINE-VERIFIED at source + logs) says CI runs the **fallback BY DEFAULT**: `m_hasResidencySet = true` is set only inside the `supportsFamily(MTL::GPUFamilyApple6)` branch (`metal-device.cpp` L121), and the hosted `Apple Paravirtual device` **lacks Apple6** — the sibling job log shows the terminal-`else` message `GPUFamilyApple6 not supported; using per-encoder useResource fallback` (L145). ⇒ #800's three `compute-indirect*.metal` passes were **very likely fallback-path execution**, i.e. the config I recorded as unverified is the one that ran. **Corrected statement: the FALLBACK path has (probable) coverage; the residency-SET path is the uncovered one, and it needs Apple6 hardware CI lacks.** Held as a strong same-image/same-adapter **inference**, not a same-run observation (the #800 logs carry no residency line either way, by construction) ⇒ does **not** retroactively make this row WOULD_APPROVE.
- Why the silence fooled me in both directions: `checkDeviceTypeAvailable` assigns `result.debugCallbackOutput` **only** in the `RETURN_NOT_AVAILABLE` failure macro (`tests/testing.cpp:884`), so a green run's unconditional `printf` prints an empty string. **An unconditional print does not imply an unconditional value.**

## Human state

- `skiminki-nv` 07-20 and `jkwak-work` 07-23 (COMMENTED, "will wait for @skallweitNV") both deferred.
- `skallweitNV` 08-03 12:43 **CHANGES_REQUESTED**, 0 inline: "LGTM. We should however enable tests in `test-compute-indirect.cpp`." Then 14:20: "CI is fixed now, please update this PR and enable tests." Then 15:26:51 **APPROVED @`bf135d7222a8`, empty body** — superseding his own CR (only its author can clear it), merging 7s later.
- Correctly **not** a fixer task: contributor-owned PR, maintainer asked the author directly, and unlike #802 this CR *was* an actionable edit list (add `Metal` to 3 masks), not a hardware-capability ask. Cf. [[feedback_changes_requested_read_body]].
- Nothing was written to GitHub (approver never posts; PR merged with maintainer approval needing no bot footprint).

## Standing follow-up

⚠️**REVISED 08-03 17:31 — the env var was never the missing artifact.** `SLANG_RHI_METAL_NO_RESIDENCY_SET` forces the path CI **already takes** (paravirtual adapter lacks Apple6 ⇒ fallback by default), so setting it adds nothing. What actually closes the residency question for this op is a run on **Apple6-capable hardware** (`m_hasResidencySet == true`), which no GitHub-hosted runner provides. `-v` remains useful only to confirm which path a given machine chose. Not a gate; nothing pending on any coworker.

## ⭐ The residency argument was CIRCULAR, not merely wrong (approver's catch, Main-verified at source)

R1's second ground for clearing Devin's 🔴 was: *"on the residency-set path EVERY buffer is globally registered via `registerResource` at creation, so it is resident regardless."* Verified at merged `d8c609ef`:

- `DeviceImpl::registerResource` is defined at `metal-device.cpp:608` and does **all** its work inside `if (m_hasResidencySet)` (`:611`).
- `metal-buffer.cpp:84` inserts into `m_addressToBuffer` **only** when `!m_hasResidencySet`; `:86` is the call site (not `:87`).

⇒ Registration happens **only on the residency-set path** — the path never in question. The argument therefore used residency-set-path registration to establish that the **fallback** was safe. That is not a weak argument about the fallback; it is one that **cannot bear on the fallback at all**.

**This is its own failure shape: an argument that cannot bear on the question is more dangerous than a wrong one, because it reads as mechanism-grounded.** It cites real `file:line` evidence, so it passes a provenance check while contributing *zero* information about the claim it is offered for. The control must be two questions: *is this true?* **and** *does this bear on the path in question?* Same family as the non-discriminating-signal rule, but on the **argument** side rather than the evidence side — a true premise about the wrong path.

**Related trap in the FIX itself** (approver found it in their own operative section, so I checked mine): writing "`metal-device.cpp:611-618` adds it to the set" is *true* but omits the gate, letting a reader reconstruct unconditional registration **from the correction**. When retracting a mechanism claim, state the gate explicitly — a retraction that leaves the mechanism readable as fact still propagates the error to anyone mining the file for domain knowledge rather than for the verdict. My private file never carried the mechanism claim; the shared atom's retraction said only "scoped backwards", now upgraded to the circularity framing across all three copies plus `1785770830139`.

## ⭐ Recording a withhold on the wrong basis is a latent FALSE-SAFE

The approver's ledger row initially rested on **review state** (`reviewDecision=CHANGES_REQUESTED` / BLOCKED)
with the residency gap secondary; it was re-recorded with the **residency gap primary** and review state
secondary. That ordering is not bookkeeping — `skallweitNV` cleared his own CHANGES_REQUESTED **51 seconds
after** the row was written, which would have **evaporated the stated basis while the actual risk persisted
untouched**. A row whose reason can be discharged by someone else's click, without the underlying risk
changing, reads as "concern resolved" to every future reader.

⇒ **Record a withhold against the most durable reason available, not the most convenient or most recently
observed one.** Ask: *if this basis disappears tomorrow, does the risk go with it?* If not, it is the wrong
basis. Same shape as the day's other lesson about signals that can't discriminate — here the signal decays
independently of the thing it was standing in for.

## ⭐ Lessons

**1. A green run adjudicates only what its log can discriminate.** I reasoned "if the refutation is wrong, these cases fault on real Metal." True for the path CI took — but I never asked *which path that was*, and the harness makes that unanswerable in a passing non-verbose run. Same failure class as [[feedback_green_job_skipped_backend_zero_coverage]] one level deeper: there a green job hid a skipped **backend**; here a genuinely-executing backend hides which **code path within it** ran. Control unchanged: *could this output have differed if my claim were false?* For "residency set was active," no. Cf. the sign-inverted instance in [[project_11225_capability_target_incompat_slangpy_break]] — a marker's absence in a 0-failure run is *guaranteed*, so it is neither positive nor negative evidence.

**2. Named tripwires are the whole value of a debounce rule.** Three synchronizes were non-operative and correctly held; the fourth was indistinguishable at the webhook layer but tripped a named condition. Pattern-matching "fourth identical webhook → hold" would have buried the one push that mattered. Cf. [[feedback_debounce_approver_dispatch_deterministic_abstain]].

**3. Appending a correction does not retract the stale claim elsewhere in the same file** — see [[feedback_correction_must_sweep_whole_file]]. This file was the case study: after correcting the residency overclaim in two places, a full re-read found it still asserted live in three others plus a duplicate MERGED section. A targeted grep for the *new* wording cannot find the *old* wording.

Separate thread, do not conflate: #807's TODO ("re-enable once Slang passes `-std=metal4.0`") is dischargeable by a **Slang pin bump** — slang-rhi main still pins `SLANG_RHI_FETCH_SLANG_VERSION "2026.12.2"` (CMakeLists.txt:148) while slang#12325 is already fixed upstream. See [[project_12325_metal4_std_flag_vs_capability]].

See [[feedback_approver_never_posts_route_reviewer]].
