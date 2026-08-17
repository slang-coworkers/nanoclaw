---
title: "A nested .git in a mirrored tree is a PII-scrub bypass the scrubber cannot see"
type: learning
topic: misc
source: learnings/1785985612990-a-nested-git-in-a-mirrored-tree-is-a-pii-scrub-byp.md
---

# A nested .git in a mirrored tree is a PII-scrub bypass the scrubber cannot see

**Measured 2026-08-06**, nightly `knowledge_base` sync (slang-coworkers/nanoclaw → `nv-coworkers`).

The auto-memory source store `/home/node/.claude/projects/-workspace-agent/memory/` **has become a git repo** (it was not one when the sync recipe was written). The recipe's mirror step is `rm -rf <dest>; mkdir -p <dest>; cp -rL <src>/. <dest>/` — which faithfully copies `.git/` along with everything else.

**Why this matters:** `scrub_kb_pii.py` rewrites *working-tree text files*. Git objects under `.git/objects` are **zlib-compressed blobs**. The scrubber cannot read them, cannot match a regex against them, and reports success. So committing a mirrored `.git` publishes the **full unscrubbed history** of every memory file — including content that the scrubber redacted in the working copy. The verification step in the recipe (`grep -rhoE '<email regex>' knowledge_base`) is equally blind for the same reason: grep on compressed data yields nothing.

⭐⭐⭐ **A scrub/redaction check validates only the encoding it can read. Compressed, encoded, or binary payloads inside the scrubbed tree pass every text-level check by construction — "grep found no emails" is not "no emails are published."**

**The tell was a count, not a grep.** Baseline was ~520 files; the mirror produced **10,011**. Breaking that down by destination isolated 772 files under `knowledge_base/auto-memory/.git`. ⇒ **Compare the mirror's file count against `git ls-tree -r --name-only HEAD <path> | wc -l` before staging.** Here: HEAD 8529 → disk 9238 after cleanup = exactly the 709 additions with 0 deletions, which is what made the diff trustworthy.

**Fix applied:** `rm -rf knowledge_base/auto-memory/.git` plus `find knowledge_base -type d -name __pycache__ -exec rm -rf {} +` after the mirror, before the scrub. Merged as PR #1094.

⚠️ **This recurs every night** — the source `.git` is live and `cp -rL` will keep copying it. The exclusion belongs *in* the mirror step (`cp` then prune, or a copy that skips VCS dirs), not in one operator's memory of having done it once. A fix that must be remembered by the next run is not a fix — cf. the same failure shape in the memory-store reindex work.

**Generalization for any publish-to-public-repo job:** before staging, assert the tree contains no nested VCS/scratch dirs:
`find <dest> -type d \( -name .git -o -name node_modules -o -name __pycache__ -o -name .venv \)` — must be empty. A source that was a plain directory when the recipe was authored can silently become a repo later; the recipe has no way to notice.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785985612990-a-nested-git-in-a-mirrored-tree-is-a-pii-scrub-byp.md`_
