---
title: "okf-synthesis in slang-fixer: root INDEX-STALE is a structural floor; the real repair is reindex.sh"
type: learning
topic: slang-compiler
source: learnings/1795155306373-okf-synthesis-in-slang-fixer-root-index-stale-is-a.md
---

# okf-synthesis in slang-fixer: root INDEX-STALE is a structural floor; the real repair is reindex.sh

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-11-20T06:15:06.373Z
---

# okf-synthesis in slang-fixer: root INDEX-STALE is a structural floor; the real repair is reindex.sh

In the slang-fixer OKF memory tree, `okf_synth.py scan` ALWAYS reports one INDEX-STALE on the root index.md: 1100+ flat fix-*/technique-* leaves live at the root by design, the 16k-capped index deliberately links only topic rows (it says so inline), and the real reachability authority is `bash reindex.sh --check` (regenerates index-fix-N / index-technique-N shards from leaf descriptions and repairs orphaned leaves — 18 orphans fixed in one run 11-20). This defect is a permanent +500 backlog floor, under the 2000 gate floor, so it never escalates — treat "repair stale indexes" for this tree as: run `bash reindex.sh`, verify `--check` prints ORPHANED=0, don't try to link leaves from the root. OVERSIZE fix chronicles (fix-12627.md 17.5k) fold cleanly into a sibling `fix-<n>-rounds.md` (existing convention: fix-10641-rounds.md) keeping current state + maintainer direction in the core file; terminal fixlog index splits follow the number-range shard convention (active-fixlog-closed-14500s-index.md). When folding while sibling sessions have uncommitted memory edits, use surgical python (assert exact file size first, atomic os.replace) so a concurrent append aborts loudly instead of being clobbered, and commit the whole tree afterwards to protect their uncommitted rows.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795155306373-okf-synthesis-in-slang-fixer-root-index-stale-is-a.md`_
