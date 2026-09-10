---
name: project_10842_metal_descriptorhandle_runtime
description: "slang#10842 DescriptorHandle support on Metal. Draft PR slang-rhi#802 (raw-native-id, Approach A1) shipped + reviewed APPROVE_WITH_NITS. TERMINAL/PARKED: fixer root-caused the red CI — the tests assume an ABI Metal lacks (top-level .Handle params emit as directly-bound, never fed handles), so there is still ZERO executed bindless coverage. NOT approved-to-merge; HW-gated (needs Apple6+); RESUME = skallweitNV/jhelferty-nv design call on re-express-via-ParameterBlock."
metadata:
  node_type: memory
  type: project
  title: "#10842 Metal DescriptorHandle runtime — PARKED, HW-gated"
  tags:
    - slang
    - slang-rhi
    - metal
    - descriptorhandle
    - bindless
    - parked
  originSessionId: 86f30980-8c62-4d53-a4a7-5114a82df6ab
---

# shader-slang/slang#10842 — DescriptorHandle support on Metal

Maintainer-assigned (jhelferty-nv). Re-triaged 2026-07-24. **Two-layer conflation resolved:** the Metal
**compiler/emit** already supports `DescriptorHandle<T>` (unwrapped to native layout,
`slang-emit-metal.cpp:148`) — the gap is the **slang-rhi runtime** (Metal backend had zero
`getDescriptorHandle` overrides, never advertised `Feature::Bindless`). Combined tex+sampler is out of
scope (`DescriptorHandle.value` is one `uint64_t`; Metal combined needs 2×64-bit → won't fit; tracked
closed as #11540). Separate buffer/texture/sampler each = one 64-bit native id → feasible.

## TERMINAL state — PARKED, not approved-to-merge

- **Draft PR slang-rhi#802** (Fixes #10842) shipped Approach **A1** exactly (raw native-id, no
  heap/allocator/residency): new Metal BindlessDescriptorSet, `Feature::Bindless` under the existing
  ArgumentBufferTier2 gate, getDescriptorHandle overrides on buffer/texture-view/sampler/AS. Maintainer
  flipped it non-draft; reviewed **APPROVE_WITH_NITS** (3-reviewer pass concurred, 0 bugs).
- **skallweitNV `CHANGES_REQUESTED` "Needs testing"** (review `4843509387`) — the ask is *get the feature
  executed*, nothing to change in code. Not coworker-actionable: the tests exist and are enabled in both
  masks; they cannot execute in our reach (Linux env doesn't compile Metal; `macos-latest` is an Apple
  Paravirtual device with no Apple6). Only **real Apple-Silicon HW** closes it — skallweitNV (Metal
  maintainer) is the likeliest party with it.
- **Upstream blocker slang#12096 is a HOLD** (`jkwak-work` assignee): `macos-latest`→`macos-26-arm64`
  fires the OS-version `metallib_4_0` gate, Slang emits the metal-4.0 attribute, the Xcode-16 toolchain
  rejects it ⇒ whole Metal device reports unsupported ⇒ all Metal tests skip. Fixer correctly offered a
  **separate** PR and did NOT fold it into #802 (would change capability reporting for every Metal user).
  Do not pick up without explicit go-ahead from jkwak-work/jhelferty-nv/skallweitNV.

## Fixer root-caused the red CI — net state is WORSE than a red run

When #807 removed the metallib_4_0 gate, the Metal device came back and #802's masked `bindless-*.metal`
cases finally executed — and **FAILED** (129 P / 76 S / 2 F; 77 failed assertions). Fixer root-caused it
(reproduced with pinned `slangc 2026.12.2` on Linux, emit/reflection only):

**The test assumes an ABI Metal lacks.** A top-level `uniform ....Handle` parameter emits on Metal as an
**ordinary directly-bound parameter** (its own `[[buffer(n)]]`/`[[texture(n)]]` slot) — no argument-buffer
member carries handle values. So the 64-bit values the test writes via `setDescriptorHandle` are **never
read**; the six handles are never bound at all. This is **intentional upstream**
(`slang-emit-metal.cpp:149-153` deliberately unwraps `DescriptorHandle<T>`; `entry-point-descriptor-handle-buffer.slang`
is a #11066 regression test *requiring* that slot assignment) — not a codegen bug. The working ABI is
`ParameterBlock`/argument-buffer.

⇒ **The OPEN_GAP is still ZERO executed bindless coverage, now for an understood reason.** "Does the
device support the design as blessed?" = **unknown, because the design was never exercised.** A1's own
premise is untested. Residency is neither confirmed nor cleared (the shader never dereferences a handle).
**Both `.metal` failures were a first-ever execution, not a regression** — there is no green baseline to
bisect against.

**A real bug found in our own patch** (not the test cause): `allocBufferHandle` returns
`getDeviceAddress()+offset` for all buffer kinds and discards `format`, but typed `Buffer<float>` emits as
`texture_buffer<...>` ⇒ needs a texture `gpuResourceID`, not an address. ⚠️ The reviewer's byte-for-byte
"raw-id equivalence" check could NOT catch this: the pre-existing bound path
(`metal-shader-object.cpp:562-563`) has the same wrong shape. **Matching an existing path is not
validation** — equivalence-to-incumbent is circular when the incumbent is also wrong.

Fixer's 3 proposed directions (awaiting maintainer, genuinely a design/scope call): (1) re-express tests
via `ParameterBlock`/argument buffer — the only thing that would test A1's premise; (2) fix or explicitly
reject typed-buffer handles; (3) narrow the `Feature::Bindless` gate. Fixer recommends (1); explicitly
**withdrew** "just mask the tests" (would hide the problem the PR's own `docs/api.md` advertises support for).

## Durable lessons

- ⭐ **Before relating a failure to a PR, ask whether that PR's code is even IN the artifact under test.**
  slang#12294 was a false alarm: slang-rhi pins a *prebuilt* Slang (`CMakeLists.txt:148`
  `SLANG_RHI_FETCH_SLANG_VERSION "2026.12.2"`), so the unmerged draft was never in the binary.
  **Scope-breadth (buffers+textures failing together) is the expected shape of ONE upstream cause, not
  evidence of a widened one.**
- 🔴 **`slang-rhi` clones are SHALLOW; git history tools LIE there.** At the graft boundary (`.git/shallow`,
  empty `%P` on a non-root commit) every pre-existing file looks newly added — `git show --stat` reported
  521 files / 125k insertions for an 11-file PR. Tell: `--follow` returns an implausibly short history for
  an old file. **Make a negative-existence claim from state-at-a-ref (REST `commits?path=`, `git grep
  <ref>`), never from a history search** — a search only says "not in the commits I could reach." When a
  tool's reliability is impeached, **re-derive EVERY live claim that leaned on it.**
  [[feedback_shallow_clone_makes_your_head_the_graft_root]].
- **"File X doesn't exist" is not a claim; "X doesn't exist at `main` but does at `<ref>`" is.** A bare
  path silently asserts `main`, which for a PR-branch artifact makes a true pointer unfindable
  (`metal-bindless-descriptor-set.*` exists on #802's head, absent at `main` — that *pins* the root-cause
  target to the right ref).
- **Verify provenance by the PATCH (line present after, absent in parent), never by proximity.** A
  verified-sounding provenance claim with the wrong commit id — right author, right date, adjacent PR
  number, correct conclusion — nobody re-checks a commit id supporting a conclusion they already agree with.
- ⭐ **Parse the WHOLE failure set before characterizing a signature, and group rows by assertion
  site/phase before inferring mechanism.** Three readers mis-read these 77 rows (each saw the hypothesis
  they arrived with) by eyeballing the first ~10. The signature is 56 zeros + 21 shifted-by-exactly-1, and
  a **heterogeneous signature does NOT imply a heterogeneous cause** — "handles never bound" predicts both
  (first-phase reads return 0; writes never land ⇒ RW resources keep their seeds).
  [[feedback_parse_whole_failure_set_before_characterizing]], [[feedback_label_dispatch_suspicions_as_hypotheses]].
- **A green macOS job only proves the Metal TUs compile** (`Metal: not supported` ⇒ all Metal tests skip,
  job still `success`). [[feedback_green_job_skipped_backend_zero_coverage]].
- **Debounce approver dispatch on a deterministic ABSTAIN:** a `Merge branch 'main'` push that leaves the
  reviewed source byte-identical is non-operative — re-engage only on a push touching `src/metal/**` or
  `tests/**`, a macOS/Metal runner change, a review, or merge/close.
  [[feedback_debounce_approver_dispatch_deterministic_abstain]].

## RESUME / cross-links

**RESUME (1):** skallweitNV / jhelferty-nv direction on fixer items 1-3 (design/scope, theirs to make).
**RESUME (2):** operator authorizes a reply to skallweitNV asking what testing he wants and who runs it.
Also fires on a macOS runner with real Metal HW appearing, a re-review, or merge/close. G1 (bindless-only
textures not made resident on the `!m_hasResidencySet` fallback — which the paravirtual runner IS) cannot
be *cleared* here regardless; needs Apple6+ HW. Same HW-gated posture as
[[project_slang_rhi_800_metal_dispatch_indirect]]; the metallib_4_0 arc is [[project_12325_metal4_std_flag_vs_capability]].
Approach-A memo with file:line pointers: `/workspace/agent/memory/triage-10842.md` (triager's fs).
Full-restate-conclusions-up-front practice retained on its own merit (the `~24.4KB Read limit` premise was
falsified — [[project_memory_files_over_read_limit_backlog]]).
