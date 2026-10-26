---
type: project
name: project_13857_llvm_constant_float_quiets_signaling_nan
description: "HUMAN-OWNED, nothing dispatched (10-22 07:45Z). slang#13857 (albertrodriguezclo, external): LLVM targets quiet a signaling NaN float constant, because maybeEmitConstant passes a double to ILLVMBuilder::getConstantFloat and slang-llvm calls ConstantFP::get(type, double) (confirmed on master 653bfdeef4). Follow-up to #13845/#13846 (still open). The author offers to implement it and asks maintainers how to build and test an ILLVMBuilder change. Does not touch our #13816 chain. 10-22 22:25Z: maintainer juliusikkala answered the build questions on the issue (comment 6352657620, no bot mention); nothing for the bot. 10-25 07:00Z: author proposes a slang-llvm-only fix (no interface change) and asks whether CI builds slang-llvm from source; not a bot mention, not routed."
---

# slang#13857: LLVM targets quiet a signaling NaN in a `float` constant

**10-22 07:37:51Z `issue_opened`.** Main webhook session `sess-1792654673326-a2cwf3`. Live read at ~07:40Z: open,
0 comments, no labels, no assignees. The only timeline event is a `cross-referenced` from PR #13846 (07:38:21Z).

**Claim checked on master `653bfdeef4`.** `source/slang/slang-emit-llvm.cpp:849` calls
`builder->getConstantFloat(type, double)`. `source/slang-llvm/slang-llvm-builder.cpp:1622-1625` returns
`llvm::ConstantFP::get(type, value)`. The narrowing quiets the NaN, as the issue states.

**Ownership.** The author filed it and writes "I can implement this". They ask the maintainers three questions:
how to build and test an `ILLVMBuilder` change without building LLVM 21.1 locally, whether a prebuilt LLVM exists,
and what an interface change needs for builds that fetch an older prebuilt slang-llvm. These are maintainer
questions. The bot must not answer on a new human issue (Contributor AI Standard R6: 4-day wait unless `bot-ok`).

**Facts for an operator who wants to answer** (not posted):
- CI builds slang-llvm from source: `.github/workflows/ci-slang-build.yml:254` configures with
  `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM`. So CI tests an `ILLVMBuilder` change.
- `FETCH_BINARY` picks the prebuilt by the release tag that `git describe` gives (`cmake/GitHubRelease.cmake:58`).
  A local branch therefore gets the slang-llvm of the last release, which has the old interface.
- `ILLVMBuilder` is a COM interface with a UUID (`slang-llvm-builder.h:130-137`). Slang finds it through the
  versioned entry point `createLLVMBuilder_V3` (`slang-emit-llvm.cpp:724-731`). A changed method is an ABI change
  between slang and slang-llvm.

**Parent chain.** #13845 / PR #13846 (same author) is still open and not merged at 07:40Z. The author pushed
c6a19bf99 at 07:38Z. See [project_13845_bitcast_fold_quiets_signaling_nan](project_13845_bitcast_fold_quiets_signaling_nan.md).
Our PR #13816 (WGSL) is not affected by this LLVM issue.

**Disposition: held, nothing dispatched or posted, no timer.** No chain of ours depends on it.

**10-22 22:25:42Z, maintainer reply** (comment 6352657620, juliusikkala; no `@nv-slang-bot`, so not routed). They say
to use `-DSLANG_SLANG_LLVM_FLAVOR=USE_SYSTEM_LLVM` with LLVM 21 or 22. They say an `ILLVMBuilder` change used to need
a release right after it, because the prebuilt slang-llvm would not match master, and ask @jkiviluoto-nv whether
the prebuilt-LLVM changes fixed that. They ask the author why `LLVMBuilder::getConstantFloat` cannot do the right
thing without an interface change. That question is for the author. The "facts for an operator" above are now
covered by the maintainer.

**10-25 07:00:46Z, author reply** (comment 6394648303; no `@nv-slang-bot`, so not routed). They agree the interface
does not need to change: after #13846 the `double` for a NaN holds the float payload in its top mantissa bits, so
`LLVMBuilder::getConstantFloat` can narrow a NaN by bits (`APFloat(IEEEsingle(), APInt(32, bits))`), with `half`
the same way. An older prebuilt slang-llvm keeps working and just keeps quieting. They have only LLVM 18-20 locally
and asks whether CI builds slang-llvm from source for a PR that touches `source/slang-llvm`.

**Answer to that, checked on master** (not posted): yes. `ci-slang-build.yml` input `build-llvm` defaults to
`true` and then configures with `USE_SYSTEM_LLVM` on an LLVM that CI builds or restores from cache (~line 255);
Windows debug builds slang-llvm in release and feeds it in as `FETCH_BINARY` with a local URL. Only the linux wasm
job (`ci.yml` ~203) and the macOS aarch64 release job (~277) set `build-llvm: false`. #13846 still open at 10-25.

**Resume on:** a maintainer asking the bot to act on #13857, a `bot-ok` label, or the operator asking for
the facts above to be posted.
