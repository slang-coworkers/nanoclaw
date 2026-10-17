---
type: project
name: project_12325_metal4_std_flag_vs_capability
description: "slang#12325 Metal-4 attribute vs downstream `-std=metal4.0` — ALREADY FIXED in slang by #12009 (first release v2026.14); reporter was on 2026.12.2 ⇒ the residual is a slang-rhi Slang-pin bump (2 version lines + 7 SHA256s), not slang-core work. Verdict `5167081493` ENDORSED by assignee jkwak-work 08-06. Kept OPEN as rhi#807's re-enable trigger. NOT a dup of #12096."
metadata:
  node_type: memory
  type: project
  originSessionId: edc48ae7-5fee-4ff7-be3f-be0d2948d5d2
---

# slang#12325 — Metal 4.0 attribute vs downstream `-std=metal4.0`

The issue was filed by `skallweitNV` and is **assigned to `jkwak-work`** (author ≠ owner; I conflated
them until 08-12). Labels: `Dev Opened`, `RTR`, Type=Bug.

**State: terminal coworker-side, issue OPEN on purpose.** It is the re-enable trigger named by
slang-rhi #807's TODOs. No fixer and no slang-core work are owed. Live state was last read 2026-08-06;
GitHub returned 401 on 2026-10-16, so the rhi pin was not re-checked then.
**RESUME:** the rhi Slang-version bump lands (then `metallib_4_0` un-comments) · a human comment that
asks us something or disputes the verdict · #802 CI with Metal actually executing.

## Verdict (comment `5167081493`, refreshed in place 08-03 13:53Z)

**The ask is already implemented at master.** The producer is `slang-code-gen.cpp:786-804`
(`PassThroughMode::MetalC`). It sets `metalLanguageVersion=4.0` from `implies(metallib_4_0)`, which
is the same predicate as the emit gate at `slang-emit-metal.cpp:227`. The consumer is
`slang-gcc-compiler-util.cpp:971-988`, which renders `-std=metal4.0`. This landed in **PR #12009**
(`a2596654f`, 07-15). `git compare` puts it ahead of `v2026.13.1` and behind **`v2026.14`** (07-24),
the first release that contains it. In the reporter's 2026.12.2, `:973` is an unconditional
`-std=metal3.1`, while the emitter already emits the 4.0 attribute, so his error is deterministic.

**Evidence: two CI jobs on the same `macos-26-arm64 / 20260728.0273.1` image** differ only in the
Slang version.

| job | Slang | Metal tests |
|---|---|---|
| rhi job `91655709447` | 2026.12.2 | **0 PASSED / 207 SKIPPED** (`requires metal4.0`) |
| slang job `91692432521` | in-tree, sends `-std=metal4.0` | **87 PASSED / 75 SKIPPED** |

That pairing also refuted my dispatch suspicion that the toolchain predates Metal 4: `metal 32023.883`
accepts `-std=metal4.0`.

**Fix = bump slang-rhi's fetched Slang to ≥ v2026.14.** The bump has 9 sites:
`SLANG_RHI_FETCH_SLANG_VERSION` at `CMakeLists.txt:148` (pinned `"2026.12.2"`),
`SLANG_HASH_VERSION` at `:307`, and the 7 `SLANG_RHI_SLANG_URL_HASH` SHA256s at
`:313 :318 :327 :332 :341 :346 :354`. Each hash is wrapped in
`if(SLANG_VERSION STREQUAL SLANG_HASH_VERSION)`. If you bump only `:148`, the hash variable is unset
and `FetchPackage(… URL_HASH "")` at `:359` downloads **unverified**. I first wrote "five" while
listing seven line numbers, and the triager caught it.

**Declined: skallweitNV's alternative** ("don't emit unless the standard is guaranteed"). The
`metallib_4_0` atom (`capdef:208`) is the host's promise. Emission precedes the downstream invocation,
so Slang cannot introspect the offline `metal` binary, and weakening the gate would silently drop a
requested attribute. One latent hygiene item remains, and it is not this bug: the emitter never calls
`requireMetalLanguageVersion(4,0)` beside `:227`. Compare the `printf` path at `:909`.

## Dedup: distinct from #12096

#12325 is "the downstream compile must pass `-std=metal4.0`". It is fixed in slang-core, and the
residual is the consumer bump. #12096 is "stop over-reporting `metallib_4_0` from the OS version
alone". That is a separate slang-rhi defect at `metal-device.cpp:266`, and #11999 folded into it. Its
triage line "no slang-core change is warranted" was too strong, because #12009 was one. #12096 stays
OPEN under jkwak-work's ownership and is not ours to close
([[feedback_dont_close_open_proposals]], [[project_12096_metal4_oscap_macos26_rhi795]]).
#12325 is not a dup of the original feature requests #10560/#10592.

## slang-rhi side

**rhi #807 (stopgap) merged 08-03 13:46:38Z**, 5 minutes after our verdict. It comments out
`metal-device.cpp:266-267` and the matching `CHECK`. Both TODOs say "re-enable once Slang passes
`-std=metal4.0`". **That condition is already satisfied at ≥ v2026.14.** The real gate is the
version bump. Because our comment became the referenced trigger, I reversed my "#807's merge is churn,
don't re-post" call and had the triager refresh `5167081493`. The reusable test: **does someone act on
this text, and would the stale version mislead them?** Detail is in
[[project_slang_rhi_807_disable_metallib_4_0]] and [[feedback_github_comment_hygiene]].

At #807's head, Metal executes (129 PASSED / 76 feature-gated SKIPPED / 0 FAILED, without
`metallib_4_0`). That does **not** close #802's gap. The runner is a paravirtual Tier-2 device without
Apple6, and `bindless-*` stays unmasked for Metal until #802's own diff. The #802 continuation is in
[[project_10842_metal_descriptorhandle_runtime]].

As of 08-06, the rhi pin was still `2026.12.2` and `metallib_4_0` was still commented out. The bump is
small and bot-doable, but it no longer unblocks #802. Its only payoff is restoring rhi's Metal 4
advertisement, which is **rhi-maintainer territory**. Offer it only if the operator asks.

## 08-06 16:26Z — the assignee endorsed the verdict (cmt `5207425279`)

> "@skallweitNV, what the bot says is that this issue is already resolved by … PR #12009. And it is a
> part of v2026.14. Since you tested with v2026.12, it appears to be a matter of upgrading the Slang
> version on slang-rhi."

**Routing: no dispatch and no post.** The webhook said `github.pr_mention`, but the body contains 0
`nv-slang-bot` mentions. It is a maintainer-to-maintainer note with no new design point and no
question for us ([[feedback_webhook_dispatch_by_event]]). It is also not an authorization, because it
directs skallweitNV ([[feedback_reopen_not_release_parked_feature]]). I hedged my dispatch premise and
let the triager measure it, and that is why the verdict could be adopted verbatim
([[feedback_label_dispatch_suspicions_as_hypotheses]], [[feedback_never_relay_a_verdict_not_in_hand]]).

Related: [[feedback_green_job_skipped_backend_zero_coverage]] ·
[[feedback_debounce_approver_dispatch_deterministic_abstain]].
