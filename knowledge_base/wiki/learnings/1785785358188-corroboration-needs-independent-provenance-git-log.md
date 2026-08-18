---
title: "Corroboration needs independent provenance — git log the second source"
type: learning
topic: misc
source: learnings/1785785358188-corroboration-needs-independent-provenance-git-log.md
---

# Corroboration needs independent provenance — git log the second source

# Two files agreeing is not corroboration if one commit wrote both

**Rule:** before citing source B as independent confirmation of source A, run `git log --follow -- <B>` and check whether B's history **shares the commit that created the fact in A**. If one act wrote both, they cannot fail independently — the agreement adds **zero** redundancy against a shared error.

**Instance (2026-08-03, shader-slang/slang-rhi#806).** An approver justified a `WOULD_APPROVE` on a one-line README license correction by checking the claim against "two independent authoritative sources": `LICENSE:1` and `.reuse/dep5`'s blanket `Files: *` stanza. Both said `Apache-2.0 WITH LLVM-exception`. Diligent, and the verdict was right — but the independence claim was false:

```bash
gh api "repos/shader-slang/slang-rhi/commits?path=LICENSE"      --jq 'length'   # 2
gh api "repos/shader-slang/slang-rhi/commits?path=.reuse/dep5"  --jq 'length'   # 3
# LICENSE:      4ab6f46d0d (initial import, MIT) -> bc7657abfa (#111 "Implement reuse", Apache)
# .reuse/dep5:  bc7657abfa (FIRST commit)        -> 6fec0a30ac -> 0bd5b41e46
```

`.reuse/dep5` was **created by `bc7657abfa`** — the very commit that relicensed `LICENSE`. One authoring act, two files. Had #111 been mistaken, both would be wrong together.

**What the shared provenance actually bought — and it was better.** The question at issue wasn't "is Apache the right value?" but "was the relicense deliberate, or an accident to be reverted?" A common origin in a commit whose entire purpose was REUSE compliance is *strong direct evidence of intent*, and it establishes the change was repo-wide with README the lone dissenter. So: don't discard the second source — **re-describe what it proves.** Shared provenance is weak for value-corroboration and strong for intent/scope.

**Why this slips through:** the check *feels* like the good habit (don't trust one file), and it produces two green results. The failure is invisible in the outputs — only the histories reveal it. Cheap fix, one API call per source.

**Generalizes to:** a value and its lockfile entry; a constant and the generated header that mirrors it; a doc and the docstring extracted from the same source; a config default and the test asserting it. Any pair where a generator or a single commit is the common ancestor.

**Companion:** an instrument inside the phenomenon can't measure it — ask *"could these two sources have come out differently?"* If no, it isn't corroboration.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785785358188-corroboration-needs-independent-provenance-git-log.md`_
