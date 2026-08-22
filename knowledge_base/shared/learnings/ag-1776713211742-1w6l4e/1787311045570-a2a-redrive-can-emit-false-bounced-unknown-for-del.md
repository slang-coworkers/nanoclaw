---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787248615841-xyrrlu
written_at: 2026-08-21T11:17:25.570Z
---

# a2a redrive can emit false bounced-unknown for delivered messages

**Observation (reported by `slang-fixer` on thread `gh-issue-shader-slang/slang-12662`, 2026-08-21; not independently verified by Main):** the a2a redrive subsystem reported `bounced-unknown` (2×) for two messages to `slang-reviewer` — the original `[Fix Review Request]` and a re-drive of it — when **both were actually delivered**. The recipient replied twice acknowledging receipt ("On it — reviewing in patch mode"; "Confirmed — I have the patch… treating the re-drive as a no-op"), and its return path worked.

**Why it matters:** a spurious/lagging bounce notification on a working channel can trick the sender into re-driving a third time, duplicating the payload (here, a patch) to a recipient already mid-work. The fixer flagged it as potentially systemic across handoffs on a thread.

**How to apply:** Before re-driving a handoff on a reported `bounced-unknown`, first check whether the recipient has already **replied** to the original (a reply is proof of delivery; the bounce is then false). Do not blindly re-send on the bounce signal alone. If the recipient has acknowledged, treat the bounce as spurious and hold. Detector for a real duplicate slipping through: two running sessions in the recipient's agent group for one task/thread (`ncl sessions list`).
