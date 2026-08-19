---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787047140363-fvdt9d
written_at: 2026-08-18T11:03:13.868Z
---

# [approver/challenger-miss] "compile-only test dir" is a checkable claim, not an assumption — verify the actual TEST directives

## Symptom
Deciding slang#12597 (Windows test-flake fix in the SLANG_TEST_SERVER_GARBLE_ON_REQUEST hook). Devin flagged a 🔴 at `tools/test-server/test-server-main.cpp:811`: the new `SLANG_RETURN_ON_FAIL(writeRaw(...))` aborts `TestServer::execute()` on a write failure, and the caller `_execute`'s `SLANG_RETURN_ON_FAIL(server.execute())` then skips `cleanDeviceCache()` + `slang::shutdown()` — a documented DeviceCache destructor-order segfault path. The production bot rated the SAME change a non-blocking 🔵. I cleared Devin's 🔴 to advisory and nearly recorded WOULD_APPROVE, on (among others) the ground that the garble test runs `kInnerTestPrefix = "tests/preprocessor/"` which "is compile-only, no device" ⇒ `cleanDeviceCache()` is a no-op ⇒ segfault unreachable.

## Root cause
That ground was FALSE, and it was the linchpin. I read the in-file comment at `unit-test-test-server-loss.cpp:40` ("tests/preprocessor is ~80 small compile-only tests with no device") and treated the comment as ground truth. But `tests/preprocessor/line-macro.slang` is `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK): -output-using-type` with a `ubuffer` input — it runs through render-test and CAN populate `DeviceCache` on a GPU host. The comment describes the *bulk* of the directory ("~80 small"), not *all* of it; one COMPARE_COMPUTE test in the set is enough to make cleanup non-trivial on Windows GPU CI — the exact platform the PR targets. I also asserted "writeRaw fails ⇒ the reply write fails identically ⇒ request unservable either way" without establishing failure-permanence (transient/short-write/interrupted-poll failures exist).

## How to catch it
- A "this directory/test is compile-only / device-free" claim is a **checkable fact**, not an assumption. `gh api .../contents/<dir>` + read the actual `//TEST:` directive of the file(s) that matter. `COMPARE_COMPUTE` / `EXECUTE` / any `TEST_INPUT:*buffer` ⇒ it runs a device backend. Do NOT trust a summarizing in-source comment ("~N small compile-only tests") to cover EVERY member — "~80 small" is a description of the majority, and the one exception is exactly what carries the blast radius.
- When a clearing rationale rests on a single "unreachable" premise, treat that premise as the thing most likely to be wrong and attack it first. Here the whole 🔴→advisory downgrade hung on "device-free"; falsifying it flipped the decision to ABSTAIN(OPEN_GAP).
- "Fails identically on the same stream" needs failure-permanence proof (does the stream stay broken / does the peer close?), not just same-stream-identity. Same-stream proves ordering, not that both writes fail together.

## Fix
Corrected to ABSTAIN_POLICY(OPEN_GAP): real PR-introduced error-path change (old `fwrite` path always `return SLANG_OK`; new path aborts + skips cleanup) + plausible transient trigger + real blast radius on Windows GPU CI + unresolved reviewer severity conflict (Devin 🔴 vs bot 🔵). Skill bar: "ABSTAIN on any plausible real trigger, real blast radius; uncertainty ⇒ ABSTAIN." The critique gate's DECISION_REVIEW (codex) caught the false premise — this is the two-tiers-catch-what-one-cannot mechanism working as designed on a genuine false-safe.
