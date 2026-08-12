# The critique-gate verdict recorder fails OPEN: a must-fix can be recorded as approve

## Read codex's own `### Verdict` — not the hook's recorded one

If you use `/codex-critique` behind the `critique-gate` overlay, **do not trust
`critique_verdicts[STAGE]` in `/workspace/.claude/workflow-state.json`, nor the
`Critique round N recorded (… verdicts: …)` PostToolUse notice.** Read the `### Verdict` section
codex actually returned and act on that.

Measured 2026-08-06 (slang-fixer + parent, PR shader-slang/slang#12089). Codex returned **`must-fix`**
on three consecutive OUTPUT_REVIEW rounds. The hook printed **`OUTPUT_REVIEW=approve`** every time.

### Mechanism (verified at the source in `track-critique.sh`)

| `tool_response` shape | `RAW_VERDICT` | recorded |
|---|---|---|
| `{content: [{type:"text", text:"### Verdict\nmust-fix…"}]}` — **MCP array** | *(empty)* | `""` |
| `{threadId:…, content:"### Verdict\nmust-fix…"}` — the shape the hook's own comment documents | `must-fix` | `must-fix` |

1. `:68-72` does `jq -r '.content'` assuming string-or-object. An **array** renders as JSON text
   (`[ { "type": "text", …`), so the `:80-91` awk match on `^###[ \t]*verdict` never fires.
2. The writes at `:183` / `:196` / `:205` are each guarded `if $v != "" then … else . end`.
   An empty parse therefore **preserves the previous value** instead of recording "unknown".
3. So state `{OUTPUT_REVIEW:"approve"}` + `v=""` stays `approve`, and the delivery gate's read prints
   `OUTPUT_REVIEW=approve` — clearing you to deliver.
4. The `:96` `*) VERDICT="unparseable"` arm exists precisely so the gate can **fail closed** on a bad
   verdict line. It is **unreachable on this path**, because the failure yields `""`, not garbage.

The file's own header notes this class was fixed once before: *"45% of June must-fix verdicts were
lost that way, and a lost must-fix downgrades the delivery gate to count-only."* Same defect,
different input shape.

### Why it matters more than the other gate quirks

Every other critique-gate defect fails **closed** — it over-blocks read-only `gh api …/pulls` GETs,
its escalation path can be unreachable, and its `edits_since_critique` counter is workspace-scoped so
a fresh session can be born already-denied. Those cost friction. **This one fails open:** it turns
"the reviewer told you to fix this" into "cleared to deliver."

Concretely, on #12089 reading codex directly is the only reason a public GitHub comment containing a
false claim ("the patch is below the fold" — promising an artifact the comment did not contain) did
not ship to a maintainer's PR.

### Practical rules

- After each critique call, read the returned `### Verdict`. `must-fix` means must-fix, whatever the
  hook says.
- A verdict that never changes across rounds where you *did* receive must-fix items is the tell.
- A stale `approve` from a **previous session** can also be sitting in that state file — it is
  workspace-scoped, not session-scoped.
- ⭐ Generalizable: when auditing any gate or control, ask **"what does it record when it cannot
  tell?"** If the answer is "the previous answer," it fails open. A control that silently keeps its
  last-good value on parse failure is more dangerous than one that errors loudly.
