# [approver/calibration] slang-rhi#819 WOULD_APPROVE→MERGED unchanged: the guilty control that PASSED, and breaking a 4-for-4 over-conservative streak

# [approver/calibration] slang-rhi#819 — WOULD_APPROVE @`4aaef9010fa6`, MERGED unchanged at that exact head ⇒ AGREEMENT

**Symptom (the thing worth recording):** my slang-rhi record was **4-for-4+ over-conservative** — #813, #814, #815, #807, #804 all abstained (mostly `OPEN_GAP`), all approved/merged by humans, several by the *same author* at the exact decided head. This PR (native-handle invalid-input coverage, `skallweitNV`) had the classic abstain-bait shape: a bot finding saying a new test "doesn't actually prove the fix". I recorded **WOULD_APPROVE** and it merged unchanged at my pinned head → **AGREEMENT**.

**Root cause of the old streak (confirmed, not hypothesized):** the bar, not the PRs. What broke the pattern was replacing the unfalsifiable question with a falsifiable one:

> ❌ "Could a human usefully look at this?" — scores an abstain *correct* whatever the human decides.
> ✅ **"What outcome would prove an ABSTAIN here WRONG?"** → *a clean human approval + merge at this head with the nits unaddressed.* That is exactly what happened.

Ask the second question before recording any abstain. If you can't name the refuting outcome, you're not withholding on evidence — you're withholding on discomfort.

## The load-bearing probe for ANY negative-test / invalid-input PR: the guilty control

A test asserting "invalid input returns an error" is consistent with two opposite worlds: the input was *rejected by the checked path*, or *the path was never reached / something else failed*. Only an assertion that **could have come out otherwise** discriminates.

Run it as a diff against base, not as a thought experiment:

```bash
git show <base>:src/<backend>/<file>.cpp | sed -n '<fn>,+20p'   # what did the OLD code return?
```

Here that paid off decisively: at base, D3D12 and Vulkan `createBufferFromNativeHandle` returned `SLANG_FAIL` for wrong-type and had **no `handle.value == 0` check at all** — a zero handle produced a live wrapper over a null resource. So the new assertions fail on pre-fix code in **both** directions (wrong code; and success-instead-of-failure). Real bits ⇒ not a paper test.

**The one genuinely weak sub-assertion, and why it's still only a nit:** `CHECK_EQ(out.get(), nullptr)` cannot detect removal of `*outBuffer = nullptr`, because `ComPtr::writeRef()` is `{ setNull(); return &m_ptr; }` (`slang-com-ptr.h:146-150`) — it nulls the slot *before* the callee runs. CodeRabbit flagged exactly this (🟡, "seed the output object first"). Correct in mechanism, but it weakens *one sub-assertion of a test whose primary assertions are proven controls* — codex independently ruled it "not load-bearing enough for `ABSTAIN_POLICY:OPEN_GAP`". **A test-strength nit on a change that strictly tightens validation is a nit to report, not grounds to withhold.**

## ⭐ Reusable: grep for an in-tree consumer that ALREADY expects the new behavior

The strongest evidence in the whole decision appeared in **no review** — I found it by enumerating call sites of the changed API:

`examples/wasm/wasm-test.cpp:61-63` **already asserted `SLANG_E_INVALID_HANDLE` + null out-param at base** (byte-identical under `git show <base>:`), because it targets WGPU, whose impl already had the pattern. Plus CUDA (`cuda-buffer.cpp:102-106`) and WGPU (`wgpu-buffer.cpp:109-113`) already implemented it at base.

⇒ **When judging an error-code / behavior change, grep for an existing consumer or sibling impl that already expects the NEW behavior.** It converts "unilateral breaking change" into "convergence onto a contract the repo already committed to" — the difference between a blocker and a non-event.

**Corollary — read the whole doc taxonomy before calling a change doc-violating.** `docs/error-handling.md:160` says "prefer `SLANG_E_INVALID_ARG` for invalid client input", which reads *against* the change; but `:19` defines `SLANG_E_INVALID_HANDLE` as "an invalid native or platform handle" — the specific line governs. One line pointing the other way is not a contradiction.

## How to catch it — slang-rhi coverage: EXECUTED, not registered

`GPU_TEST_CASE` prints a row per flagged device **whether or not it ran**; the tallies here showed 776 / 982 / 1203 *skipped*. Two traps I nearly hit:

1. **"There are no test jobs"** — a misread. slang-rhi runs tests as a **step inside** each `build (...)` job (`./slang-rhi-tests -check-devices`), on self-hosted `nvrgfx-kernelvm-bridge` runners. Read the workflow *steps*, not the job-name list.
2. **A per-backend zero can be a padding artifact.** Logs are column-padded, so always pair the claim with a control grep that MUST be non-zero.

What proof looks like (from `ci` run job logs, `status=completed`, 19/19 jobs, head_sha = pinned):

| leg | observed |
|---|---|
| windows x86_64 clang Debug (self-hosted) | `buffer-from-handle.{d3d12,vulkan,cuda,wgpu} PASSED`; `texture-from-native-handle.{d3d12,vulkan} PASSED` |
| linux x86_64 clang Debug (self-hosted) | `buffer-from-handle.{cuda,vulkan,wgpu} PASSED`; `texture-from-native-handle.vulkan PASSED` |
| macos aarch64 clang Debug | `buffer-from-handle.metal PASSED`; `texture-from-native-handle.metal PASSED` |

Control that made the Metal claim safe: **133 `.metal PASSED` rows vs 642 "device not available" skips** on the macOS leg ⇒ the device was genuinely present. All three modified backends executed the new assertions.

## Fix / standing rules

1. **Negative-test PR ⇒ run the guilty control against base.** "Could this assertion have come out otherwise?" If no ⇒ the test carries zero bits. If yes ⇒ stop treating a test-strength nit as an `OPEN_GAP`.
2. **Before an abstain, name the outcome that would refute it.** Can't name one ⇒ it's not an evidence-based withhold.
3. **Grep for an in-tree consumer/sibling already expecting the new behavior** before calling a behavior change unilateral.
4. **Prove per-backend execution from job logs + a must-be-nonzero control**, never from a green badge.
5. **A stale staged state is still a state claim.** I staged `state=OPEN, reviews=[]`; Devin's page metadata later said "Merged". I re-queried rather than dismissing or inheriting it — the PR had merged **mid-run** at my exact head. Incidental metadata from a best-effort tool can be the only signal your pinned world-model moved.

