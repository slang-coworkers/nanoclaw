# Fixer A/B Test — slangpy#943 (2026-05-09)

## Setup

| | A | B |
|--|---|---|
| Agent | slang-fixer | slang-fixer-b |
| Type | slang-writer (instructions-only) | slang-fixer (workflow-typed) |
| Workflow | inherited slang-implement | fix-issue (enforced steps) |
| Critique | Self-initiated (1 round) | Multi-gate (DIAGNOSIS + OUTPUT, 5 rounds total) |

## Tool Usage

| Tool | A | B |
|------|---|---|
| Bash | 17 | 11 |
| Read | 3 | 6 |
| Write | 3 | 6 |
| Edit | 6 | 2 |
| TodoWrite | 4 | 8 |
| Codex critique | 2 | **6** |
| send_message | 0 | **4** |
| DeepWiki | 0 | 1 |
| WebFetch | 0 | 2 |
| TOTAL | 35 | 47 |

## Evaluation (5-star scale)

### Better Software

| | A | B |
|--|---|---|
| Structural correctness | ✅ Verified all 4 edge cases | ✅ Verified all + found new one |
| Finds real risks | Scope expansion (Artifactory), merge ordering | Same + `CIBW_ENVIRONMENT_LINUX` drop risk, `build_type` default change |
| Self-correction | 1 error caught (tag-gate claim) | 2 errors caught by critique (severity overstatement + unverified claim) |
| Actionable output | Clear TL;DR + recommendations | 5-bullet summary + 2 pre-merge concerns |
| **Score** | ★★★★★ | ★★★★★ |

Both produce output a senior engineer would approve. B found one additional risk (CIBW_ENVIRONMENT_LINUX silently dropping on Linux nightly) that A missed.

### Adaptation

| | A | B |
|--|---|---|
| Recognized "review, not fix" | ✅ Immediately | ✅ Immediately |
| Pivoted workflow | Yes (ignored fix steps, did review) | Yes (adapted fix-issue workflow to review mode) |
| Handled sandbox failures | N/A | ✅ Inlined content when codex sandbox blocked (round 2) |
| **Score** | ★★★★★ | ★★★★★ |

Both perfectly adapted to the mismatch between "fixer" role and "review" task. B additionally adapted to infrastructure failures (sandbox) gracefully.

### Out-of-box Solutions

| | A | B |
|--|---|---|
| Found unstated risks | Artifactory scope expansion, `.devN` guard, `upload_pypi` tag-gate gap | `build_type=nightly` default change, `CIBW_ENVIRONMENT_LINUX` cross-PR interaction |
| Proposed actions | Merge #925 first, then rebase #963 | Must-document the default change before merge |
| Creative insights | Composite action lacks shallow-clone self-check | N/A |
| **Score** | ★★★★☆ | ★★★★☆ |

Both found real issues nobody asked about. Slightly different focus — A more breadth (more items), B more depth (fewer but with verified precision).

### Thinking

| | A | B |
|--|---|---|
| Reasoning depth | Self-corrected once (tag-gate claim vs actual blob) | Multi-round self-correction (severity overstatement, unverified premise) |
| Verified claims | Yes (checked PR head blob) | Yes (cited round 1 must-fix resolution) |
| Intellectual honesty | Corrected error inline | Caught itself overstating severity and pulled back |
| **Score** | ★★★★★ | ★★★★★ |

Both exhibit strong self-monitoring. B is slightly more disciplined (explicit critique protocol forces verification).

### Autonomy

| | A | B |
|--|---|---|
| Questions asked | 0 | 0 |
| Completion time | ~7 min | ~20 min |
| End-to-end | ✅ Full report, no hand-holding | ✅ Full report, multi-gate process, no hand-holding |
| Used send_message | No (inline only) | Yes (4x — critique status + final) |
| **Score** | ★★★★★ | ★★★★★ |

Both fully autonomous. A is 3x faster. B takes longer due to critique rounds but provides progress updates.

## Key Differences

| Dimension | A wins | B wins |
|-----------|--------|--------|
| Speed | ✅ 7 min | — |
| Self-correction rigor | — | ✅ Multi-round, catches more |
| Parent notification | — | ✅ 4 send_messages vs 0 |
| Risk coverage | ✅ More items found (breadth) | ✅ Deeper verification (precision) |
| Handles infra failures | N/A | ✅ Sandbox workaround |
| Extra finding | `.devN` guard, `upload_pypi` gap | `CIBW_ENVIRONMENT_LINUX` cross-PR |

## Verdict

**Tie on quality.** Both produce senior-engineer-level output. Neither is hacky or produces workarounds.

**A is pragmatic** — one-pass, fast, breadth-first, finds many things efficiently.
**B is rigorous** — multi-gate, slower, depth-first, validates its own claims harder.

**For production recommendation:**
- Use A (instructions-only + self-initiated critique) for **speed-sensitive** reviews where breadth matters
- Use B (workflow + multi-gate critique) for **safety-critical** reviews where precision and verified claims matter
- The critique gate adds **verification confidence** — you know B's claims were independently checked

**The surprising finding:** A self-initiated codex critique WITHOUT being told to (it's in the instructions but not enforced). B was REQUIRED to critique (workflow + overlay). Both ended up at the same quality level, suggesting the model's internal quality bar matches the external enforcement — at least for this caliber of task.
