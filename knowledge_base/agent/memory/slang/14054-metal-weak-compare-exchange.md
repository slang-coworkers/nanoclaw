---
type: chain
title: slang#14054 — Metal compareExchange emits one weak CAS, so a spurious failure reads as success
description: "Human bug (albertrodriguezclo, cloth-sim batch) 10-29 21:51Z. Metal kIROp_AtomicCompareExchange (and the texture-atomic branch) emits a single atomic_compare_exchange_weak_explicit; HLSL semantics are strong. Metal twin of #13917/#13918 (WGSL). Triaged 22:08Z: emit reproduced, premise CONTESTED (MSL 4.1 spec text is strong). Park 5-bullet POSTED 11-02 21:56Z (issuecomment-6589472862), Type=Bug, assignee jkwak-work (set by jhelferty-nv 18:40Z). Awaiting jkwak-work harden/no-harden. 11-06 22:58Z the reporter offered to send the #13918-style PR themselves if jkwak-work agrees, so no bot fix. Relayed to the triager. Re-check t-c62394 (11-09 22:00Z) found reporter PR #14404 (ready, Fixes #14054) awaiting jkwak-work review; bot stands down, no timer."
tags: [metal, atomics, target-emit, r6]
---

# slang#14054: Metal `InterlockedCompareExchange` / `Atomic<T>.compareExchange` is weak

**Filed** 2026-10-29T21:51:28Z by albertrodriguezclo (external, same cloth-sim batch as #14053/#14057/#14058).
No labels, no assignee, 0 comments at dispatch.

**Claim.** `slang-emit-metal.cpp`, `kIROp_AtomicCompareExchange`, emits one `atomic_compare_exchange_weak_explicit`
and returns the comparand. MSL allows a spurious failure that leaves the comparand equal to `cmp`, so the
caller sees "success" with nothing stored. The texture-atomic branch uses `atomic_compare_exchange_weak` too.
Asked fix: loop `while (!weak(...) && expected == cmp) {}` — the shape of the author's WGSL PR #13918 (#13917).

**Routing (10-29 ~21:56Z).** `grep 14054 memory/slang/` had no hits. The only session on
`gh-issue-shader-slang/slang-14054` was my Main webhook session `sess-1793310695528-xfp82z`. No author fix PR
at 21:53Z (unlike #13917, where #13918 came 6 s after the issue). Dispatched to slang-triager.
**R6:** no labels, no crash word → no bot comment before 2026-11-02T21:51:28Z.

**Adjacent (not owned here):** #14031 / bot draft PR #14044 (head f800a8e21) edits `slang-emit-metal.cpp`
atomics (64-bit), not the CAS branch — file overlap only. #14058 (Metal discarded atomic results) and #14060
(Metal `Atomic<float>` compareExchange rejected, E55204) are siblings in the same emit area; #14060 arrives on
its own webhook.

**[Triage] 10-29 22:08Z (triager; memo `/workspace/inbox/a2a-1793311738823-53abgy/triage-14054.md`).**
bug, premise contested / high if real / target-emit Metal / P2. Not a regression (weak since #5125, 2024-09).
- Emit reproduced on master 977df1246 for every CAS path (buffer, groupshared, BAB, `InterlockedCompareStore`,
  `Atomic<T>.compareExchange`, RWTexture `.atomic_compare_exchange_weak`). The single site is
  `slang-emit-metal.cpp:552-599`. **I verified it** at 977df1246b (both weak emits are in that range).
- **Premise contested:** the MSL 4.1 spec §6.16.4.4 defines memcmp/memcpy semantics, which are strong, and never
  says "spurious". The only evidence for a weak CAS is the name and the AIR `cmpxchg.weak`. No Apple GPU is available to test.
  The retry loop is a no-op if the CAS is strong, so it is cheap hardening, and doing it is a maintainer call.
- Recommended fix A: mirror #13918's inline loop and hoist ptr/cmp/val (CodeRabbit 392a0b6). Textures compare `e.x`.
- Interactions: #14060 float CAS needs a bitwise loop test (−0.0 vs +0.0 spins forever), owned by whichever lands second;
  #14058 also touches line 561; #14044 is a rebase conflict only.
- No fixer handoff. I made no GitHub write. **Timer `i14054-r6-expiry-cb1c` (triager group) is verified:** session
  `sess-1793311695450-tzxzny` is on `system:tasks:i14054-r6-expiry-cb1c`. It fires 11-02 21:55Z: it re-checks the issue,
  posts the park 5-bullet (spec finding plus a question to a Metal maintainer, cc jkwak-work), and sets Type Bug. No `reproduced` label.

**[Report] 11-02 21:57Z (triager, R6-expiry timer).** I verified both on GitHub at 22:0xZ. The park 5-bullet was posted
21:56:44Z (https://github.com/shader-slang/slang/issues/14054#issuecomment-6589472862). Type is now Bug. There are no labels and
no `reproduced`. jhelferty-nv assigned jkwak-work at 18:40Z without a comment. The reporter has no Metal CAS PR. The emit site is
unchanged on master 9b46bca64. Next: jkwak-work decides whether to harden; if yes, send the triage-14054.md brief to slang-fixer
on this thread. The triager's one-shot re-check **t-c62394** is verified (session `sess-1793656623666-ai7h11` on
`system:tasks:t-c62394`). It fires 2026-11-09 22:00Z. The R6 hold was stale (retired 11-02, see Core Memory), so the 4-day delay
on this post was an artifact of that rule.

**11-06 22:58Z: reporter comment** (issuecomment-6697884120, not an @nv-slang-bot mention). albertrodriguezclo argues for hardening:
the MSL name and AIR `cmpxchg weak` allow spurious failure in LLVM terms, a hardware stress test can't disprove it, and the
#13918 loop is free when the CAS is strong. They note that #14210 (merged 11-05 as 37fc7aa7d, closes #14060) sends
`Atomic<float>.compareExchange` through the same emit site, so the loop must compare bits (`as_type<uint>`). **They offer to send
the PR themselves "if @jkwak-work agrees".** Live state at 23:0xZ: assignee jkwak-work, no labels, no author PR yet. I relayed
the comment verbatim to the triager owner session `sess-1793310920091-1zt46g` on the canonical thread, with this rule: no bot fix
while the author's offer stands, and the bot posts only a short delta if one is warranted.

**11-06 23:13Z: the triager posted a delta** (issuecomment-6698143860; I verified it live). The bot stands down in favor of the reporter's PR and
confirms that the loop needs a bitwise compare (`as_type<uint>`). The decision stays with jkwak-work. The emit site is now `slang-emit-metal.cpp:509-553` @ 442487688.
⚠️ **Triager correction to its 10-29 triage:** −0.0 vs +0.0 does NOT spin. The in/out `expected` becomes −0.0, so the retry
**stores**: a success against bits the caller never passed. A NaN comparand exits early and can lose the store. Both are fixed by
comparing bits. I had relayed the wrong "spins forever" claim to the dashboard on 10-29, and corrected it 11-06.
Re-check `t-c62394` (11-09 22:00Z) now looks for a reporter PR that compares bits, or a jkwak-work reply. It goes to the fixer only if jkwak-work asks the bot or the reporter withdraws.

**[Report] 11-09 22:02Z (triager, re-check t-c62394). I verified it live at 22:0xZ.** The reporter opened PR #14404
"Metal: retry a weak compare-exchange that fails spuriously" on 11-08 09:10Z. It is not a draft, its body has `Fixes #14054`,
and its head is `53219076d`. It changes 5 files: `slang-emit-metal.cpp` +99/−24, `slang-emit-metal.h`, and
`tests/metal/{compare-exchange-strong (new), atomic-float-device, read-write-texture-fence}.slang`. The requested
reviewer is jkwak-work. The only review so far is CodeRabbit's (COMMENTED). The triager says the diff compares bits
(`as_type<uint>` for float, `ushort` for half, `.x` for textures) and evaluates operands once; I did not re-read the diff.
CI shows only the gate jobs (filter, CLA, board-sync, SlangPy trigger; all pass) and **`review` failed**. That job is
Claude PR Review (`pull_request_target`), and I checked it: `Unexpected HTTP response: 504` from the LLM gateway, which is
infra, not the PR. No build or test lanes have run yet, which is normal for a fork PR that waits on maintainer approval.
The issue has no comments since our 11-06 delta 6698143860. Its assignee is still jkwak-work, and it has no labels.
Neither the triager nor I posted anything, no fixer was dispatched, and no timer was set. Reviewing #14404 is a separate
chain that we don't own, and this session runs no bot review of it.

**Open / resume on (current):** #14404 closed unmerged; the reporter withdraws; jkwak-work asks the bot; or a human comments
on #14054. **If #14404 merges**, the triager sends a positive close-out. Adjacent, not owned: #14414 (the reporter's
SPIR-V/GLSL float CAS on integers) and #14408 ([record](14408-spirv-glsl-float-atomic-cas.md)).

**Superseded resume list (pre-11-09):** a maintainer reply after the 11-02 post; an author fix PR; or an operator go-ahead to harden it now
(dispatch the memo's fixer brief to slang-fixer on this thread).
