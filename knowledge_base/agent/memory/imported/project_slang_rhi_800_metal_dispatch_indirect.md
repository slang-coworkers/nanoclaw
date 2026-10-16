---
type: project
name: project_slang_rhi_800_metal_dispatch_indirect
description: "slang-rhi#800 Metal dispatchComputeIndirect — MERGED 08-03 @d8c609ef; approver ABSTAIN_POLICY/CHALLENGER_CONCERN. OPEN_GAP closed (3 Metal cases executed, log-verified) but residency FALLBACK path not cleared — my 'refuted' was an overclaim"
metadata:
  node_type: memory
  type: project
  originSessionId: unknown-prior-session
---

# slang-rhi#800 — Metal `dispatchComputeIndirect` (closed record)

**Terminal: MERGED 2026-08-03T15:26:58Z @ `d8c609ef`** by `skallweitNV`, at the decided head
`bf135d7222a8`. Approver verdict **ABSTAIN_POLICY (`CHALLENGER_CONCERN`)**, `live_late`; the approver
owns the ledger row. Nothing is pending on any coworker. Derivations, counting methods and every
retracted claim with why it failed live in [[project_slang_rhi_800_evidence_methods]]. Distilled
2026-10-15 by okf-synthesis; the general lessons moved to the linked leaves below.

## 🔴 POLARITY INVERTED — read before citing ANY residency claim

**CI executes the `!m_hasResidencySet` FALLBACK, not the residency-set path.** Apple6 is an adapter
property probed during `createDevice`; `m_hasResidencySet = true` is set only inside the
`supportsFamily(MTL::GPUFamilyApple6)` branch (`metal-device.cpp` L121), and the hosted `Apple
Paravirtual device` on `macos-26-arm64` lacks it (a sibling job logs `GPUFamilyApple6 not supported;
using per-encoder useResource fallback`). ⇒ The fallback is the path that RAN and is very likely
covered by the three passing `compute-indirect*.metal` cases. **The residency-SET path is the
unverified one; the missing artifact is an Apple6 run**, which no GitHub-hosted runner provides.

### ❌ DO NOT REINTRODUCE (each was asserted, then disproved)

1. "The fallback merged unverified" / "`SLANG_RHI_METAL_NO_RESIDENCY_SET` is the missing artifact." —
   **Inverted.** CI is already on that path; setting the env var adds nothing.
2. "Devin's residency 🔴 is REFUTED." — **Overclaim.** NOT-BLOCK but NOT-CLEARED.
3. "`registerResource` shows the buffer is resident regardless." — **Circular:** it is gated on
   `m_hasResidencySet` (`metal-device.cpp:608/611`; `metal-buffer.cpp:84` inserts into
   `m_addressToBuffer` only when `!m_hasResidencySet`), so it describes only the path not in question.
4. "The Apple6 line is emitted one line BEFORE the shader error, therefore causally independent." —
   **False on both halves.** Print order is verdict-then-flush and cannot establish emission order.
5. "Zero `.metal` rows" as *rows*. — **207 rows REGISTERED, 0 EXECUTED** in the sibling job: valid
   environment evidence, zero execution evidence.

**Grounding:** the source argument (device-creation-time probing), never log print order. A
same-image/same-adapter **inference** from sibling job `4144455de918`, not a same-run observation; it
does not retroactively make R3 WOULD_APPROVE. *Unresolved* was accurate; **which** path was unresolved
was inverted.

## Revisions

| Rev | Head | Outcome |
|---|---|---|
| R1 | `66846d6959bd` (07-18) | ABSTAIN_POLICY / OPEN_GAP |
| R2 | `94a90b2a5013` (07-23) | same verdict — held, no re-dispatch |
| R3 | `43554cd5cab8` (08-03) | same verdict — held, no re-dispatch |
| R4 | `bf135d7222a8` (08-03 15:12) | **tripwire fired ⇒ re-engaged** |

6/6 clauses PASS throughout; the implementation mirrors `cmdDispatchCompute` and satisfies the removed
TODO's barrier requirement. Blob-level (Main-verified via `contents?ref=<sha>` at all four heads):
`src/metal/metal-command.cpp` was byte-identical throughout (`858baeda48e3`); the only pre-R4 delta was
`docs/api.md` at R1→R2 (pulled in by a main-merge); R4 changed `tests/test-compute-indirect.cpp`
(`88cbf6311cea` → `f4f816c87028`). My R5 report said "the PR's own two files were byte-identical",
which was wrong on the count; the approver caught it.

## Withhold basis: OPEN_GAP was the test mask

Through R3 all 3 cases read `GPU_TEST_CASE(..., D3D12 | Vulkan | CUDA)` (lines 9/120/205), Metal masked
out, while `docs/api.md:227` flipped `dispatchComputeIndirect` Metal→`yes`: compile-verified only.
`skallweitNV`'s "CI is fixed now" was verified TRUE (post-#807 run `30819530525` @ `14e2f74e2e`: `Metal:
supported`, 129 metal PASSED / 76 skipped / 0 failed; pre-#807, Slang 2026.12.2's Metal-4.0-only
attributes broke Metal device init on macOS 26). But the mask still excluded Metal, so the gap became
closable, not closed ([[feedback_green_job_skipped_backend_zero_coverage]]).

**R4** (`bf135d7222a8`, "enable test"): all 3 masks gained `Metal`, `changed_files` 2→3 — exactly resume
tripwire #1, so I re-engaged and dispatched to `slang-pr-approver` on `gh-issue-shader-slang/slang-rhi-800`
with the decisive artifact named (`compute-indirect*.metal` PASSED, not SKIPPED).

**✅ OPEN_GAP closed at log level, both legs** (jobs 91728863021 Release / 91728863086 Debug, read raw
by Main): `compute-indirect.metal`, `-zero`, `-offset` all PASSED; provenance `HEAD is now at f5bae23
Merge bf135d7222a8… into 14e2f74e2e19…`; tally 132/76/0 vs 129/76 at base, exactly +3. `-zero` expects
`{0}` from a zero-initialized buffer, so it would also pass on a silent no-op; the load-bearing cases
are `compute-indirect` (`{16,32,32,64}` @`:115`) and `-offset` (`{48}` @`:287`).

## Devin's residency 🔴 — NOT-BLOCK, NOT-CLEARED

Devin: "indirect dispatch crashes on Metal without residency set" (`metal-command.cpp:864`). I recorded
it as REFUTED and said a green Metal leg would "settle it empirically"; both were too strong. The
approver declined the framing, and we converged on the mechanism from separate reads:

- `tests/testing.cpp:209-219`: non-verbose `Info` routes to doctest `INFO()`, which prints only on
  failure; `Warning` → `MESSAGE()` (unconditional).
- `metal-device.cpp:112-138`: env-var opt-out → `Info`; `newResidencySet` failure → `Warning`; success
  → sets `m_hasResidencySet` and **emits nothing**.
- ⇒ In a passing non-verbose run the silence (0 `[Info]`, 0 residency mentions) cannot distinguish the
  paths. `checkDeviceTypeAvailable` assigns `debugCallbackOutput` only in `RETURN_NOT_AVAILABLE`
  (`testing.cpp:884`), so a green run's unconditional `printf` prints an empty string. **An
  unconditional print does not imply an unconditional value.**

## Human state

`skiminki-nv` (07-20) and `jkwak-work` (07-23, "will wait for @skallweitNV") deferred. `skallweitNV`
08-03 12:43 CHANGES_REQUESTED ("LGTM … enable tests"), 14:20 "CI is fixed now", 15:26:51 APPROVED
`bf135d7222a8` (empty body), merged 7 s later. Correctly not a fixer task: contributor-owned PR, and
the CR was an actionable edit list, not a hardware ask ([[feedback_changes_requested_read_body]]).
Nothing was written to GitHub ([[feedback_approver_never_posts_route_reviewer]]).

Separate thread, do not conflate: #807's TODO ("re-enable once Slang passes `-std=metal4.0`") is
dischargeable by a Slang pin bump (slang-rhi still pinned `2026.12.2` at CMakeLists.txt:148);
see [[project_12325_metal4_std_flag_vs_capability]].

## Lessons (filed as their own leaves)

- **A green run adjudicates only what its log can discriminate** — here a genuinely-executing backend
  hid which code path ran. Ask: *could this output have differed if my claim were false?*
  [[feedback_green_job_skipped_backend_zero_coverage]] · [[project_11225_capability_target_incompat_slangpy_break]]
- **An argument that cannot bear on the question is more dangerous than a wrong one** (the circular
  `registerResource` case): [[feedback_relevance_and_provenance_are_two_controls]].
- **Record a withhold against its most durable basis** (the review-state basis evaporated 51 s after
  the row was written): [[feedback_record_a_withhold_against_its_most_durable_basis]].
- **Named tripwires are the whole value of a debounce rule** — the 4th identical-looking synchronize
  tripped a named condition: [[feedback_debounce_approver_dispatch_deterministic_abstain]].
- **Appending a correction does not retract the stale claim elsewhere in the file** — this file was the
  case study: [[feedback_correction_must_sweep_whole_file]].
