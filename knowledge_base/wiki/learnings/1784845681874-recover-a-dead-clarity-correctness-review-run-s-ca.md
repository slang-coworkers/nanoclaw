---
title: "Recover a dead clarity/correctness review run's candidates from stream.jsonl"
type: learning
topic: review-process
source: learnings/1784845681874-recover-a-dead-clarity-correctness-review-run-s-ca.md
---

# Recover a dead clarity/correctness review run's candidates from stream.jsonl

When a `slang-pr-review-runner` / `slang-clarity-review-runner` background run dies with a transient `API Error: Connection closed mid-response`, its output file (`clarity-review.md` / `final-review.md`) contains only the error string — but the review content is usually **not lost**. The pipeline writes candidate files (e.g. `tmp/review-candidates/pr-<N>-clarity.md`, `pr-<N>-fine-grained-clarity.md`) via the `Write`/`Edit` tools *before* the final consolidation step, and those tool calls are recorded verbatim in the run dir's `stream.jsonl`.

**Recovery recipe** (worktree is GC'd on disk after the run, so the files themselves are gone — reconstruct from the stream):

```python
import json
writes={}; edits={}
with open('<run_dir>/stream.jsonl') as f:
    for line in f:
        try:
            o=json.loads(line)
            if o.get('type')=='assistant':
                for c in o.get('message',{}).get('content',[]):
                    if c.get('type')=='tool_use':
                        n=c['name']; inp=c.get('input',{}); p=inp.get('file_path','')
                        if n=='Write' and 'clarity' in p: writes[p]=inp.get('content',''); edits[p]=[]
                        elif n=='Edit' and 'clarity' in p: edits.setdefault(p,[]).append((inp['old_string'],inp['new_string']))
        except: pass
for p,content in writes.items():
    for old,new in edits.get(p,[]): content=content.replace(old,new,1)  # replay edits in order
    open('<run_dir>/RECOVERED-candidates.md','a').write(content)
```

Notes:
- Replay `Edit`s onto the last `Write` content, in stream order (`replace(old,new,1)`).
- These are **pre-consolidation** candidates (before scope-filter/dedup), so best used as a fallback. If cheap, also **re-run** the reviewer for a clean consolidated output — and overlap the re-run with any still-running sibling reviewer so no wall-clock is lost.
- Confirm drift is clean on the dead run before trusting it: `grep -cE '"(gh api|gh pr|slang-review-post-github)"|--method (POST|PUT)|/reviews' <run_dir>/tool-uses.jsonl` must be 0.
- A mid-consolidation drop still counts the generation passes as complete, so you typically recover the full candidate set. Verified on shader-slang/slang#12206 round-2 (Reviewer C).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784845681874-recover-a-dead-clarity-correctness-review-run-s-ca.md`_
