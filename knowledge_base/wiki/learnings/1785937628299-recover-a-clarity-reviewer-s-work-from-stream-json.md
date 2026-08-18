---
title: "Recover a clarity-reviewer's work from stream.jsonl after its auto-removed worktree takes the files"
type: learning
topic: review-process
source: learnings/1785937628299-recover-a-clarity-reviewer-s-work-from-stream-json.md
---

# Recover a clarity-reviewer's work from stream.jsonl after its auto-removed worktree takes the files

## The failure

`slang-clarity-review-runner` (Reviewer C) died on `API Error: Request rejected (429)` mid-run on
shader-slang/slang#12358. Its `clarity-review.md` was **59 bytes containing the 429 text itself**.

Two distinct ways C's output file ends up near-empty — don't conflate them:
1. **Known extractor defect** — the extractor keeps only the *last* assistant text block, so a review
   ending in a short amendment lands tiny. (See `reviewer-final-md-is-last-text-block-only`.)
2. **This case** — the run *died*, and the error string became the last text block. `stream.jsonl`
   `[RESULT] is_error=True`, 71 turns, $8.47 spent. Substantive work had already happened.

## Why the obvious recovery fails

C does its real work in `<worktree>/tmp/review-candidates/*.md`. That worktree is
`wt-clarity-*`, and **the runner auto-removes it on exit** — so by the time you look, the files are
gone even though the run cost $8. `git worktree list` no longer shows it.

## The recovery

The `Write`/`Edit` tool calls are in `stream.jsonl` **with their full payloads**. Replay them:

```python
import json, glob, os
p = glob.glob('.../transcripts/pr-pr<NUM>-*/stream.jsonl')[0]
out = {}
for line in open(p):
    try: d = json.loads(line)
    except: continue
    if d.get('type') != 'assistant': continue
    for c in d.get('message', {}).get('content', []):
        if c.get('type') != 'tool_use': continue
        inp = c.get('input', {}); fp = inp.get('file_path', '')
        if 'review-candidates' not in fp: continue
        base = os.path.basename(fp)
        if c.get('name') == 'Write':
            out[base] = inp.get('content', '')
        elif c.get('name') == 'Edit' and base in out:      # replay edits in order
            o, n = inp.get('old_string',''), inp.get('new_string','')
            if o in out[base]: out[base] = out[base].replace(o, n, 1)
for k, v in out.items(): open(os.path.join(dest, k), 'w').write(v)
```

Recovered 33.8 KB consolidated + 14.9 KB high-level + 12.5 KB fine-grained — a complete review
(6 Keep, 8 Drop, coverage audit). **Replay `Edit`s in stream order after the `Write`**, or you get
the pre-edit draft.

## Related: C's worktree HEAD and diff hash both look wrong but are benign

Two false alarms worth pre-empting, both on #12358:

- **Worktree HEAD ≠ PR head.** C's worktree sat at master (`7175a561`) with a clean tree and the
  PR's change *absent* from `CLAUDE.md`. Benign: C reviews the diff it fetches via
  `gh pr diff <N>`; the worktree only hosts the `.claude/skills/slang-review-*` it reads. Confirm by
  checking its `tmp/pr-diff.patch` content, not the checkout.
- **`tmp/pr-diff.patch` sha ≠ authoritative sha.** Differed (`cb540fa6…` vs `2ee5c582…`) because C
  hand-`Write`s the patch rather than piping it, losing trailing-whitespace-only context lines.
  Benign — but *prove* it: `grep -E '^\+' | sha256sum` on both must match (they did:
  `68db472e…`). A raw-file hash mismatch is not by itself a wrong-PR review; the `+` lines are.

## Also: A and C fight over shared `slang/tmp/`

Dispatching A and C ~2s apart made C clear `/workspace/agent/slang/tmp/`, deleting A's pre-staged
`pr-files.txt`/`pr-diff.patch`. A aborted with `REVIEW-GUARD FAIL`, 55-byte output, **zero subagent
dispatches** — an abort, *not* a wrong-PR review (its `context.json` held the correct sha).
Re-dispatch A once C's staging is past, and check the subagent-dispatch count to tell a real run
from an aborted one.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785937628299-recover-a-clarity-reviewer-s-work-from-stream-json.md`_
