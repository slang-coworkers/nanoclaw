---
title: "[approver/clause-gap] 'That isn't mine' is authoritative for your SESSION and non-authoritative for your GROUP — a denial inherits the scope of the surface you checked"
type: learning
topic: review-approval
source: learnings/1785820074643-approver-clause-gap-that-isn-t-mine-is-authoritati.md
---

# [approver/clause-gap] "That isn't mine" is authoritative for your SESSION and non-authoritative for your GROUP — a denial inherits the scope of the surface you checked

**Symptom.** A peer attributed a defect report to me. I denied it: zero mentions of the PR number in my transcript, and no matching thread in the session list I had printed. **Both facts true, and the denial was still misleading.** `ncl sessions get <cited-id>` returned `agent_group_id` = **my own group**, thread `gh-issue-…-804`, status `running` — a **sibling session** I had simply never seen. Had the peer accepted my denial, they would have retracted a *true* claim and told an operator that a real defect report had no owner.

**Root cause.** I reasoned from my own transcript, which is the only surface a session naturally inspects — and **nothing prompts a session to enumerate its siblings**, even when the CLI scope already grants it. My scope is `group`, which includes `sessions`; the information was one command away and I never ran it. Same shape as the "grep your own store first" rule: the cheapest available check is precisely the one nothing reminds you to run, because the surface you're standing on feels like the whole world.

**The rule.** **A denial inherits the scope of the surface you checked.** So state the scope you actually verified, never the scope the question was asked in:
- ✅ *"Not this session (`…wzx7m9`) — verified by transcript. It IS my group (`…bvj5tl`, thread rhi-804) — verified by `sessions get`. I cannot read that session's transcript, so I can confirm ownership but not the finding."*
- ❌ *"That isn't mine."*

**Cure, one command each, before denying attribution of anything:** `ncl sessions list` (group-wide) and `ncl sessions get <cited-id>`. Then answer per-scope.

**Enumerating cost almost nothing and found more than the tier who *could* read the ledger had:** my group held **two** sessions on that PR (an issue-thread and a PR-thread, both `running`), where their account named one; and their "805×4" was in fact a single 805 session. So the group-wide list corrected the party with broader read access — worth noting, because the instinct when someone has strictly more visibility is to defer.

**Attribution format that is unfalsifiable by either side: group + session id + thread.** "slang-pr-approver (session `…bvj5tl`, thread rhi-804)". Bare "you reported X" is ambiguous exactly when a group runs concurrent sessions — which for a webhook-driven group is the *normal* case (17 sessions on one repo, several running simultaneously), not an edge case.

**Why this pairs with "a wrong id is worse than no id."** That earlier rule says: when the authoritative field is out of your reach, name it rather than approximating. This is its complement: **when the authoritative field IS within your reach, checking it is mandatory before you assert a negative.** The two failure modes are opposite — inventing an identifier you cannot verify, versus denying one you could have verified — and both are avoided by asking "which surface answers this, and can I read it?" before speaking. A confident negative from a narrow surface is the more insidious of the two, because it *sounds* like first-hand knowledge and it quietly closes the question.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785820074643-approver-clause-gap-that-isn-t-mine-is-authoritati.md`_
