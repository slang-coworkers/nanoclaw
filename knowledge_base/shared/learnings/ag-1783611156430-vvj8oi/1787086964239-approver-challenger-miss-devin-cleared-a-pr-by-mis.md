---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787086126486-d7kw84
written_at: 2026-08-18T21:02:44.239Z
---

# [approver/challenger-miss] Devin cleared a PR by misreading the central mechanism — verify a bot's summary against the diff before trusting its "no bugs"

**PR:** shader-slang/slang#12599 @ 76d00453dc63 (fallback tier — no github-actions[bot] review; CodeRabbit + Devin only). Decided ABSTAIN_POLICY(OPEN_GAP).

**Symptom.** Devin's head-current run returned "Bugs: (none) / Flags: (none)", i.e. a clean clearance. But its own *change summary* said the PR "Dropped the `sha256sum -c` verification step" and that "integrity now relies on TLS plus GitHub's own asset hosting."

**Root cause.** That is factually contradicted by the head diff: checksum verification is RETAINED — `startup.sh:187` verifies the download against `latest_runner_digest`, read from the release asset's `digest` field (a field GitHub began publishing June 2025); `startup.ps1` likewise via `Get-FileHash` vs `$runnerAsset.digest`. The PR replaced a *pre-known constant* SHA with a *fetched-per-asset* SHA — it did not drop verification. Devin inverted the single most security-relevant fact of the change.

**How to catch it.** When a reviewer (Devin especially, on the fallback tier) returns "no bugs," do not take the verdict at face value — read its prose summary and cross-check its claims against the actual diff. If the reviewer misdescribes the *central mechanism* of the change (here: what happened to the checksum step), its clearance carries near-zero weight on subtler gaps, because it demonstrably was not looking at the code you're deciding on. A "clean" verdict from a reviewer that misread the diff must NOT be allowed to offset a concrete stability concern from the other reviewer.

**Fix / rule.** Bot "no bugs" is a *prior conditioned on the bot having read the change correctly*. Falsify that condition first: pick the one or two load-bearing facts of the diff and confirm the reviewer's summary matches them. A mismatch downgrades the source to "did not review this," not "reviewed and found nothing." This is the fallback-tier analogue of "read the actual source before trusting a code claim."

**Adjacent (the actual gap that drove the abstain):** boot-time unauthenticated `api.github.com` lookups made UNCONDITIONALLY per VM boot, failing closed (`shutdown -h now`) — 60 req/hr per shared egress IP can mass-kill a CI fleet, reintroducing the outage class the PR fixes. CodeRabbit flagged this Major/High-merge-risk "not merge-ready"; Devin missed it entirely (consistent with having misread the diff).
