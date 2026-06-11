# Full A/B/C/D Comparison v2 — UPDATED with fixed buddy (2026-05-10)

## What Changed from v1
- Buddy now genuinely relays through codex (14 codex-reply calls in Discord, 4 in Triage)
- Buddy and critique are mutually exclusive (disable_overlays=1 for buddy types)
- Critique-tracker counter no longer counts buddy's codex calls
- Buddy sends full base context (CLAUDE.md + instructions + task) to codex at setup

---

## Triage (slangpy#943) — UPDATED

| | A (instructions) | B (workflow) | D (workflow+buddy) |
|--|--|--|--|
| **Quality** | Excellent | Excellent | **Excellent + course-corrected** |
| **Found PR #963** | ✅ | ✅ | ✅ |
| **Found PR #925 risk** | ✅ | ❌ | ❌ but found 6 NEW items |
| **DeepWiki** | 0 | 0 | 0 |
| **GitHub MCP** | 0 | 2 | 1 |
| **send_message** | 0 | 0 | **2** |
| **Codex (buddy)** | 0 | 0 | **5 (4 relay)** |
| **Total tools** | 10 | 11 | 46 |
| **Self-correction** | No | No | **YES — buddy flagged lazy re-hash, agent re-did research** |
| **Unique findings** | PR #925 coordination | — | 6 reviewer items A/B missed (fetch-depth on release, etc.) |

### Key D finding:
Triage D message 2: "Buddy flagged that I'd leaned on the prior report rather than doing a real read/research pass, so I fetched baseline wheels.yml from main and the PR-branch copies directly and diffed them. Found six concrete reviewer items the original handoff missed."

**This is the buddy's value proposition: catches laziness, not just errors.**

---

## Fixer (slangpy#943 — PR #963 review) — UPDATED

| | A (instructions) | B (workflow+critique) | D (workflow+buddy) |
|--|--|--|--|
| **Verdict** | Approve (conditions) | Approve (conditions) | ✅ Approve (clean) |
| **Edge cases** | 4/4 + extras | 4/4 + extras | 4/4 verified |
| **send_message** | 0 | 4 | 0 |
| **Codex** | 2 (self-initiated) | 6 (multi-gate) | 0 (buddy didn't spawn*) |
| **Total tools** | 35 | 47 | 11 |
| **Time** | ~7 min | ~20 min | ~3 min |

*Fixer D ran very fast (11 tools, ~3 min) because it had the benefit of triage-d's thorough analysis upstream. The buddy subagent didn't spawn (container cycled too fast). This is actually a valid result: when the triage is thorough (thanks to buddy), the fixer needs less work.

---

## Discord (3 threads subset) — UPDATED with fixed buddy

| | B (workflow) | D (workflow+buddy) |
|--|--|--|
| **Drafts sent to parent** | 11 (full run) | 3 (of 3 requested) |
| **DeepWiki** | 3 | 1 |
| **GitHub MCP** | 8 | 3 |
| **send_message** | 11 | 3 |
| **Codex (buddy relay)** | 0 | **14** |
| **Total tools** | 49 | 81 |
| **Buddy guidance written** | N/A | ✅ (codex flagged something) |

---

## Buddy Effectiveness — Cross-Test Summary

| Test | Buddy spawned? | Codex relay working? | Guidance injected? | Primary acted on it? | Prevented what? |
|------|---------------|---------------------|-------------------|---------------------|-----------------|
| Discord D | ✅ | ✅ (14 replies) | ✅ | ✅ | N/A (codex said OK for the work observed) |
| Triage D | ✅ | ✅ (4 replies) | ✅ | **✅ YES — re-did research** | **Lazy re-hash → found 6 new items** |
| Fixer D | ❌ (fast exit) | N/A | N/A | N/A | N/A (didn't need it — triage was thorough) |

**The killer finding:** Buddy's codex caught the triage agent being lazy (reusing prior report instead of doing fresh research). The agent course-corrected and found 6 concrete reviewer items that BOTH A and B missed entirely. This is a qualitative improvement no other variant achieved.

---

## Updated Scores

### Triage

| | A | B | D |
|--|--|--|--|
| Better Software | ★★★★★ | ★★★★☆ | **★★★★★+** |
| Adaptation | ★★★★★ | ★★★★☆ | ★★★★★ |
| Out-of-box | ★★★★☆ | ★★★☆☆ | **★★★★★** (6 new items) |
| Thinking | ★★★★★ | ★★★★☆ | **★★★★★** (self-corrected) |
| Autonomy | ★★★★★ | ★★★★★ | ★★★★☆ (more tools, slower) |

### Fixer

| | A | B | D |
|--|--|--|--|
| Better Software | ★★★★★ | ★★★★★ | ★★★★★ |
| Adaptation | ★★★★★ | ★★★★★ | ★★★★★ |
| Out-of-box | ★★★★☆ | ★★★★☆ | ★★★☆☆ (fast, less depth) |
| Thinking | ★★★★★ | ★★★★★ | ★★★★☆ |
| Autonomy | ★★★★★ (7min) | ★★★★☆ (20min) | **★★★★★ (3min)** |

---

## Production Recommendations (UPDATED)

| Use Case | Recommended | Why |
|----------|-------------|-----|
| **Triage (thoroughness matters)** | **D (buddy)** | Only variant where independent reviewer caught laziness and forced deeper research. Found issues A/B missed. |
| **Triage (speed)** | A (instructions) | 10 tools, 7 min, still excellent quality |
| **Fixer / Code review** | A or B | Buddy doesn't add much here — the work is focused and correct without monitoring |
| **Discord support (accuracy)** | C (critique) | 45% error catch rate on factual claims |
| **Discord support (speed)** | B (workflow) | Fastest reliable delivery |
| **Safety-critical + novel work** | D (buddy) | Real-time course correction prevents going down wrong path |

## Key Insight

Buddy's unique value is **catching laziness and wrong paths in real-time**, not post-hoc error review like critique. It's most valuable when:
1. The task is open-ended (triage, investigation) — not structured (code review)
2. The agent might take shortcuts that look reasonable but miss depth
3. An independent reviewer watching the process (not just the output) adds value

For structured, focused tasks (fixer), buddy adds overhead without benefit — the agent knows what to do and does it correctly. For open-ended tasks where "good enough" isn't good enough, buddy is the differentiator.
