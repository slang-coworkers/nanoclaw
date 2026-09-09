---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1785838009652-qbyodo
written_at: 2026-08-11T15:00:49.898Z
---

# Maintainer feedback: our GitHub comments are too verbose — length is a cost we impose, not thoroughness we display

**Maintainer `swoods-nv` on shader-slang/slang#12337, 2026-08-11 (cmt `5254798012`), verbatim: _"The bot is extremely verbose here. Can anyone tell me why I was assigned?"_**

Measured footprint on that one issue: **issue body 10,297 chars / 59 lines** + a **4,395-char** follow-up comment = ~14.7 KB of bot prose. The human comments on the same issue: 665 chars (tangent-vector) and 73 chars (swoods-nv). **We out-wrote the humans ~20:1.**

## The rule

**Length is a cost we impose on a reader, not thoroughness we display.** Every maintainer landing on an issue pays it. A 5-bullet report shape and a "verify every claim" discipline do NOT license unbounded prose — they license *correct* prose, which is usually *shorter*. The verification work belongs in the chain note on disk; the GitHub comment carries the conclusion plus only the receipts a reviewer needs to check it.

⭐ **Concretely, for a GitHub comment:** lead with the answer in one or two sentences. Put file:line receipts inline, not as a narrated tour of how they were found. Cut: the enumeration of searches run, the framing of what a finding is *not*, the caveats-about-caveats, and the meta-commentary about verification method. A reader who wants the derivation can ask.

⚠️ **The trap when responding to this exact feedback: replying at length.** A verbose apology for verbosity confirms the complaint. Acknowledge in one sentence, fix the behavior, move on.

## Second finding, same issue: verbosity hid two false numbers

The 4,395-char comment claimed Slang's `SLANG_OPTIMIZATION_LEVEL_DEFAULT` arm "registers **16 passes** unconditionally" and headlined "**~16** spirv-opt passes against zero". Actual live count at `b0e43d657`, `slang-glslang.cpp:345-383`: **14** register; two (`CreateIfConversionPass`, `CreateBlockMergePass`) are **commented out** and were counted anyway. The glslang side said "28 passes — 27 unconditional plus StripDebugInfo gated"; actual is **28 total, 25 unconditional**, with 1 gated on `stripDebugInfo` and **2 on `optimizeSize`** (`SpvTools.cpp:185-228`).

⭐⭐ **A commented-out line inside a block you are counting is invisible to a count-the-lines read.** `grep -cE '^\s+optimizer\.RegisterPass'` = 14 vs `grep -cE '^\s+// optimizer\.RegisterPass'` = 2 — the discriminator is one anchored `//`, and an unanchored pattern silently merges the two sets.

⭐⭐⭐ **The connection is not incidental: long prose is where unchecked figures survive.** Both wrong numbers sat in the longest comment on the issue, past the point any reader would still be auditing. Brevity is a *correctness* mechanism, not just a courtesy — fewer claims means every claim gets checked.

## Also: do not let the bot's own artifact answer a question about human action

`swoods-nv` asked why he was assigned. The answer is in the timeline, not in anything we wrote: **`jhelferty-nv` assigned `kaizhangNV` at 2026-08-05T18:06:47Z and `swoods-nv` at 18:09:07Z.** The bot has never assigned anyone on this issue and holds no assignment capability. ⇒ `gh api repos/<o>/<r>/issues/<n>/timeline --jq '.[]|select(.event=="assigned")|"\(.assignee.login) BY=\(.actor.login) at=\(.created_at)"'` answers "why am I assigned" in one call. **Answer it with the timeline actor, and do not speculate** — a maintainer asking "why was I assigned" may be about to conclude the bot did it.
