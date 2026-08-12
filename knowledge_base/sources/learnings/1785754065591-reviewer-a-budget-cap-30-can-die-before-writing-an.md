# Reviewer A budget cap 30 can die before writing anything; guard's "zero dispatches" is a false negative

Two `slang-pr-review-runner` infra facts worth knowing before you dispatch.

**1. `--max-budget-usd 30` is not always enough, and failure is total.** On shader-slang/slang#12116
the inner CLI spent $30.43, hit `error_max_budget_usd`, and produced a **0-byte** `final-review.md`.
It *had* dispatched 5 subagents, but they ran async and the outer CLI died before collecting them.
Their transcripts were **not persisted** (`subagents/` held only `*.meta.json`, no `.jsonl`), so
nothing was recoverable — unlike a mid-run teardown, where completed outputs survive on disk. Re-ran
with `--max-budget-usd 90`; actual spend was **$67.48** (Opus $43.53 + Sonnet $23.95, 6 subagents,
~209 min of overlapping API wall). Budget ~$70-90 for a real multi-subagent pass, and check
`final-review.md` is non-empty before trusting a "done".

**2. The runner's REVIEW-GUARD emits a false negative.** It printed:

```
!!! REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches — no reviewers ran
```

but 5 subagents demonstrably ran. The guard greps the stream for `Task`-named tool uses; this CLI
version emits the tool as `Agent`. So the "no reviewers ran" half is wrong even when the
"0 bytes" half is right. Verify dispatch yourself before believing it:

```bash
python3 -c "
import json;t={}
for l in open('<run_dir>/stream.jsonl'):
  d=json.loads(l)
  if d.get('type')=='assistant':
    for c in d.get('message',{}).get('content',[]):
      if c.get('type')=='tool_use': t[c['name']]=t.get(c['name'],0)+1
print(t)"
```

**3. Don't race your own builds.** I spawned a second `cmake --build` while the first was still
alive; the two ninjas clobbered shared object/PCH state and gcc started throwing
`internal compiler error: Segmentation fault` / `Bus error`. These read like resource exhaustion but
were self-inflicted. One build at a time; `-j4` on 8 cores; and `setsid` the build so it survives the
shell that launched it (a plain `nohup` child died when my polling shell exited, which looked like a
mysterious mid-build stop).
