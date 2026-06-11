# Full A/B/C/D Comparison — All Tests (2026-05-09)

## Evaluation Criteria (priority order)
1. **Better Software** — would you ship this? Production-quality, no hacks
2. **Adaptation** — adjusts when task doesn't fit expected pattern
3. **Out-of-box** — finds things nobody asked for, challenges premises
4. **Thinking** — correct reasoning, self-correction, intellectual honesty
5. **Autonomy** — end-to-end without hand-holding

---

## Discord Support (11 summon threads)

| | A (instructions) | B (workflow) | C (workflow+critique) | D (workflow+buddy) |
|--|--|--|--|--|
| **Completed** | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 |
| **DeepWiki** | 0 | 3 | 9 | 0 |
| **GitHub MCP** | 0 | 8 | 1 | 0 |
| **send_message** | 0 | 11 | 13 | 0 |
| **Codex** | 0 | 0 | 7 (critique) | 3 (buddy) |
| **Errors caught** | 0 | 0 | 8 factual | 2 gaps in existing answers |
| **Time** | ~2hr | ~30min | ~40min | ~15min |
| **Unique value** | Good training knowledge | Delivered to parent | Verified accuracy | Found gaps in EXISTING answers |

### Scores (Discord)

| | A | B | C | D |
|--|--|--|--|--|
| Better Software | ★★★☆☆ | ★★★★☆ | ★★★★★ | ★★★★☆ |
| Adaptation | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| Out-of-box | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| Thinking | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★★☆ |
| Autonomy | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |

**Discord verdict:** C for accuracy-critical (45% error catch rate). D for novel insights (found gaps in prod answers). B for reliable delivery.

---

## Triage (slangpy#943)

| | A (instructions) | B (workflow) | D (workflow+buddy) |
|--|--|--|--|
| **Quality** | Excellent | Excellent | Good (hampered by bug) |
| **Found PR #963** | ✅ | ✅ | ✅ |
| **Found PR #925 risk** | ✅ | ❌ | ❌ |
| **DeepWiki** | 0 | 0 | 0 |
| **GitHub MCP** | 0 | 2 | 3 |
| **send_message** | 0 | 0 | 1 |
| **Codex** | 0 | 0 | 4 (buddy) |
| **Bash (gh CLI)** | 9 | 8 | 36 |
| **Total tools** | 10 | 11 | 66 |
| **Buddy value** | N/A | N/A | Caught critique-tracker bug |

### Scores (Triage)

| | A | B | D |
|--|--|--|--|
| Better Software | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Adaptation | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Out-of-box | ★★★★☆ (PR #925) | ★★★☆☆ | ★★★★☆ (infra bug) |
| Thinking | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Autonomy | ★★★★★ (10 calls) | ★★★★★ (11 calls) | ★★★☆☆ (66 calls, bug detour) |

**Triage verdict:** A wins — pragmatic, efficient, found the most issues with fewest calls. Workflow didn't add value when gh CLI is available. Buddy's value was infrastructure debugging, not triage quality.

---

## Fixer (slangpy#943 — PR #963 review)

| | A (instructions) | B (workflow+critique) | D (workflow+buddy) |
|--|--|--|--|
| **Verdict on PR** | Approve (conditions) | Approve (conditions) | Request-changes |
| **Edge cases verified** | 4/4 | 4/4 + new finding | 4/4 + 2 must-fix |
| **Self-correction** | 1 (tag-gate claim) | 2 (severity + unverified claim) | via critique rounds |
| **DeepWiki** | 0 | 1 | 0 |
| **GitHub MCP** | 0 | 0 | 0 |
| **send_message** | 0 | 4 | 1 |
| **Codex critique** | 2 (self-initiated) | 6 (multi-gate) | 3 (buddy+critique) |
| **Time** | ~7 min | ~20 min | ~15 min |
| **Total tools** | 35 | 47 | 38 |
| **Unique findings** | `.devN` guard, `upload_pypi` gap, composite shallow-clone | `build_type` default change, `CIBW_ENVIRONMENT_LINUX` | Same as B + explicit `request-changes` |

### Scores (Fixer)

| | A | B | D |
|--|--|--|--|
| Better Software | ★★★★★ | ★★★★★ | ★★★★★ |
| Adaptation | ★★★★★ | ★★★★★ | ★★★★★ |
| Out-of-box | ★★★★☆ | ★★★★☆ | ★★★★☆ |
| Thinking | ★★★★★ | ★★★★★ | ★★★★★ |
| Autonomy | ★★★★★ (7min) | ★★★★☆ (20min) | ★★★★★ (15min) |

**Fixer verdict:** All three produce senior-engineer quality. A is fastest. B is most rigorous (multi-gate). D is a good middle ground (buddy watches without blocking).

Key difference: D gave `request-changes` while A/B gave conditional approval. D's critique identified 2 concrete must-fix items (CIBW_ENVIRONMENT merge semantics + upload_pypi tag-gate) that A and B noted as "nice-to-have" or "should-fix." D's buddy-informed critique was more decisive.

---

## Buddy Overlay — Specific Evaluation

| Question | Discord D | Triage D | Fixer D |
|----------|-----------|----------|---------|
| Did buddy spawn? | ✅ | ✅ | ✅ |
| Did codex monitor fire? | ✅ (3 calls) | ✅ (4 calls) | ✅ (3 calls) |
| Was guidance written? | ✅ | ✅ | No (clean run) |
| Was guidance injected via hook? | ❌ (hook not yet active on first run) | ✅ (caught counter bug) | N/A |
| Did primary act on guidance? | ✅ (acknowledged, adapted approach) | ✅ (reported bug) | N/A |
| Did buddy prevent a mistake? | Partially (corrected workflow confusion) | Yes (diagnosed infrastructure bug) | No (no issues to catch) |
| Unique buddy contribution | Found gaps in existing answers | Diagnosed critique-counter false-positive | Clean run — no intervention needed |

**Buddy verdict:** Most valuable when things go WRONG — it's an early warning system for infrastructure conflicts and wrong assumptions. Less valuable when the primary is already doing well (fixer D had nothing to catch). Its diagnostic capability (explaining WHY something failed) is the standout feature.

---

## Overall Production Recommendations

| Use Case | Recommended Variant | Why |
|----------|-------------------|-----|
| **Discord support (async forums)** | C (critique) | 45% error catch rate; accuracy matters for public answers |
| **Discord support (latency-sensitive)** | B (workflow) | Fastest complete delivery |
| **Issue triage** | A (instructions) | Pragmatic, efficient, finds the most with least cost |
| **Code review / investigation** | A or D | A for speed; D when infrastructure interactions are complex |
| **Safety-critical delivery** | B + C (workflow + critique) | Verified, multi-gate, audit trail |
| **Novel infrastructure debugging** | D (buddy) | Catches system-level conflicts no other variant sees |

## Key Learnings

1. **Workflows enforce delivery** (send_message) but don't prevent gh CLI shortcuts
2. **Critique catches factual errors** (45% rate in Discord) — essential for public-facing output
3. **Buddy catches infrastructure bugs** — a different value proposition from quality review
4. **Instructions-only (A) is surprisingly strong** for senior-level tasks — the model's internal quality bar is high
5. **Speed vs rigor tradeoff is real** — A: 7min, B: 20min, C: 40min. Quality is comparable.
6. **The critique-counter + buddy collision** shows that overlay composition needs careful testing
