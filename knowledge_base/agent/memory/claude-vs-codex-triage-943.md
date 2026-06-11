# Claude vs Codex Provider — Triage #943 (2026-05-10)

## Setup

| | Claude (Triage A) | Codex (slang-triager-codex) |
|--|--|--|
| Provider | claude (default) | codex (GPT-5.5 via nvinference) |
| Type | slang-reader | slang-triager |
| Hooks enforced | Yes (settings.json) | No (Codex ignores hooks) |
| Overlays | critique-overlay (inherited) | In CLAUDE.md text only (not enforced) |

## Output

### Claude A
- 1 message: comprehensive triage (PR #963 found, PR #925 risk, reconciliation surface analysis)
- Classified: enhancement/medium
- Used: Bash 9x (gh CLI), Write 0x
- Time: ~7 min

### Codex
- 4 messages: DIAGNOSIS_REVIEW → report draft → OUTPUT_REVIEW → final delivery
- Classified: "valid P2 CI/release workflow refactor; duplicated wheel workflow ownership"
- Voluntarily ran DIAGNOSIS_REVIEW + OUTPUT_REVIEW (from CLAUDE.md text, no hook enforcement!)
- Time: ~3 min (03:25:26 → 03:28:02)

## Comparison

| Metric | Claude A | Codex |
|--------|---------|-------|
| Quality | Excellent | Good |
| Found PR #963 | ✅ | ✅ (likely) |
| Found PR #925 risk | ✅ | Unknown (report on disk, not in message) |
| Followed workflow | No (used gh CLI) | YES — voluntarily ran critique gates |
| send_message | 0 | 0 (reported inline) |
| DeepWiki | 0 | 0 |
| GitHub MCP | 0 | 0 (no hook events to confirm) |
| Self-critique | No | YES — DIAGNOSIS + OUTPUT review |
| Time | ~7 min | ~3 min |
| Hook events visible | Yes (dashboard) | **No** (zero events — blind spot) |

## Key Finding: Codex Voluntarily Follows Critique

Despite having NO hook enforcement (Codex ignores settings.json), the Codex agent read the critique-overlay instructions in its CLAUDE.md and **voluntarily ran both DIAGNOSIS_REVIEW and OUTPUT_REVIEW**. This means:

1. Codex respects embedded workflow/overlay text as instructions
2. The AGENTS.md symlink (→CLAUDE.md) delivers the full spine content
3. Codex's instruction-following for structured workflows is STRONG

## Limitation: No Observability

Zero hook events for Codex means:
- Dashboard timeline is blind to Codex activity
- Can't count tool calls
- Can't verify which MCP tools were used
- Only see outbound messages (final output)

## Verdict

| Dimension | Claude A | Codex |
|-----------|---------|-------|
| Better Software | ★★★★★ | ★★★★☆ (less detail in output) |
| Adaptation | ★★★★★ | ★★★★☆ |
| Thinking | ★★★★★ | ★★★★☆ (voluntary critique = good judgment) |
| Autonomy | ★★★★★ | ★★★★★ (faster, fully autonomous) |
| Observability | ★★★★★ | ★☆☆☆☆ (blind) |

**Claude wins on depth and observability. Codex wins on speed and voluntary workflow compliance.** Codex's willingness to self-critique without enforcement is a positive signal for the model's instruction-following quality.
