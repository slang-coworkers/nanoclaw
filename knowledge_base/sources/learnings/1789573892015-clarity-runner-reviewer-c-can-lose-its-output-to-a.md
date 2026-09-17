---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789460667721-wi2xgn
written_at: 2026-09-16T15:51:32.015Z
---

# Clarity-runner (Reviewer C) can lose its output to a tmp/ file — recover it from the Write tool call in stream.jsonl

The `slang-clarity-review-runner` (Reviewer C in `/slang-pr-review`) extracts its result by taking the **last assistant TEXT message** → `clarity-review.md`. But the clarity workflow's final step sometimes WRITES the canonical candidate file to `tmp/review-candidates/pr-<N>-clarity-workflow.md` (via the Write tool) instead of pasting it as text — so the model's last text is a mid-workflow line like "Now let me consolidate…" and `clarity-review.md` ends up a ~1KB stub. Because the stub is above the runner's ~135–500 B incomplete-guard floor, it exits rc=0 / `terminal_reason=completed` with NO `CLARITY-INCOMPLETE` marker — it looks fine but the real review is missing. The isolation worktree (`wt-clarity-*`) holding the tmp/ file is GC'd shortly after, so you cannot read it from disk.

Recovery (don't re-run — wastes ~$3–4 + ~20 min and may recur): the full canonical review is captured in the run dir's `stream.jsonl` as the **content of the Write tool_use**. Extract it:
```python
import json
best=("",0)
for ln in open("<run_dir_C>/stream.jsonl"):
    ln=ln.strip()
    if not ln.startswith("{"): continue
    e=json.loads(ln)
    if e.get("type")!="assistant": continue
    for c in e.get("message",{}).get("content",[]):
        if c.get("type")=="tool_use" and c.get("name")=="Write":
            p=c["input"].get("file_path",""); ct=c["input"].get("content","")
            if p.endswith("clarity-workflow.md") and len(ct)>best[1]: best=(ct,len(ct))
open("clarity-review-recovered.md","w").write(best[0])
```
Detection heuristic: if `clarity-review.md` is suspiciously small (< a few KB) and its text trails off mid-workflow, check `stream.jsonl` for Write calls to `*review-candidates*` before concluding C was skipped. Note the recovery + provenance in the combined report so the fixer knows it's genuine C output. (Seen on shader-slang/slang#13086 round-4; the larger 11-file diff didn't cause it — round-3's smaller diff pasted the file as text — so it's non-deterministic model behavior, not a size/budget cap: that run cost only $3.46 of a $30 cap.)
