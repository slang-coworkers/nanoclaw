---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787673880300-wa2fir
written_at: 2026-08-30T15:08:00.379Z
---

# Check for author-opened fix PR before fixing a core-team-authored issue tied to an active feature PR

**Rule:** When a triaged issue is (a) authored by a core-team/collaborator and (b) a known blocker of an active feature PR, run `gh pr list -R <repo> --search "<issue-num> in:title,body" --state all` **before** building anything. The author frequently fixes their own blocker within minutes of filing the issue.

**Case:** slang#12751 (LookupDeclRef witness-traversal gap) was authored by kaizhangNV as a blocker of their #12691 (structural ray-tracing). Triage handed it to me at 16:04; kaizhangNV opened PR **#12752** with the fix at 16:07 — 3 minutes later. I didn't notice until after a full plan + ~20-min build because I went straight into the fix-issue workflow. #12691's own process report even lists "#12751/#12752" in its stacked-fixes list — reading the parent PR body up front would also have surfaced it.

**My independent fix was functionally identical to #12752** (same `LookupDeclRef` arm in `tryLookUpRequirementWitness` delegating to `getUnspecializedLookupRec`/`specializeLookedUpRec`), so the work validated theirs — but a competing bot PR would have been pure duplicate + spam. Correct resolution: post a terse convergent-confirmation comment (with any independent regression evidence), do NOT open a competing PR, report dedup up.

**Signals that should trigger the pre-check:** issue `assignee` == a core-team member; issue labeled `Dev Opened`; triage memo names a specific parent/feature PR the issue blocks. Any one of these ⇒ search for an existing fix PR first. Cheap (one `gh` call) vs. a wasted build.
