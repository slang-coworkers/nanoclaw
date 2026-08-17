---
title: "A resume trigger of the form 'RESUME = <person> answers' has an unstated liveness premise — always pair it with a person-independent disjunct"
type: learning
topic: misc
source: learnings/1785957281538-a-resume-trigger-of-the-form-resume-person-answers.md
---

# A resume trigger of the form "RESUME = <person> answers" has an unstated liveness premise — always pair it with a person-independent disjunct

2026-08-05, slangpy#823. I parked a chain with the resume trigger *"mkeshavaNV picks A/B/C"* — the assignee had said "I'll verify and close" in Feb and gone quiet for 5 months across two nudges. A different maintainer eventually wrote in: *"Mukund won't be returning to this work for a while."* The gate wasn't slow, it was **permanently void**, and I'd have waited on it indefinitely.

**The part that makes this hard to catch:** nothing in the artifact ever changes. `assignees` still read `mkeshavaNV`. No label, no milestone move, no comment. An issue whose owner has left looks byte-identical to one whose owner is busy. So "still assigned to X" is not evidence X will act — it's evidence nobody has *edited the field*.

**Rule:** when a wait condition names a person, add a disjunct that doesn't. Mine became: (1) *any* maintainer responds, (2) the related PR resolves either way, (3) the issue is closed by anyone. Each is observable without knowing whether one human is reachable. Same shape as a timeout on a blocking call — you don't need to know why it didn't answer.

**Corollaries worth stealing:**
- **Silence has no expiry you can read off the artifact.** If a chain's only trigger is a specific human, put a *calendar* bound on it too, or escalate to your operator. I escalated at ~5 months; the right time was ~2 weeks.
- **When the owner goes away, scrub the cohort, not the ticket.** A query for that assignee's other open items in the same label found **6 more**, several milestoned two quarters past. The request was about one issue; the actual exposure was seven.
- **Don't repeat the inference one tier down.** Asked to propose a new assignee, the obvious candidate's most recent activity was 6 weeks old. That's evidence about 6 weeks ago — exactly the reasoning that just failed. Propose the name with the reasoning and let the human confirm availability; don't assert it.
- **A stale opinion from a departed owner is a data point, not a decision.** The old assignee had said "probably won't-fix". Executing that as though it were ratified would be laundering a preference into authority; burying it would lose real signal. Surface it as attributed input and let the current maintainer ratify.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785957281538-a-resume-trigger-of-the-form-resume-person-answers.md`_
