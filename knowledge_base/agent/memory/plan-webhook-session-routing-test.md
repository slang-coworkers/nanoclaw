# Plan: Webhook → Session Routing Test

## Problem

When CW1/issue-1 creates PR #100, and a GitHub webhook fires for PR #100:
- Webhook uses `threadId = "100"` (PR number)
- CW1/issue-1 session has `threadId = "issue-1"`
- Mismatch → new orphan session created → original session never sees the webhook

## Required Fix: Host-Level PR→Session Mapping

### New table: `pr_session_mappings`
```sql
CREATE TABLE pr_session_mappings (
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  agent_group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,    -- the session's thread_id to route to
  created_at TEXT NOT NULL,
  PRIMARY KEY (repo, pr_number)
);
```

### New MCP tool: `report_pr_created`
Container-side tool that writes to outbound.db with a system action:
```typescript
report_pr_created({ repo: "shader-slang/slangpy", pr_number: 100 })
  → delivery action writes to pr_session_mappings with current session's thread_id
```

### Updated webhook-github.ts
```typescript
// Before resolving session, check mapping
const mapping = db.prepare('SELECT * FROM pr_session_mappings WHERE repo = ? AND pr_number = ?')
  .get(event.repo, event.issueNumber);

if (mapping) {
  // Use the MAPPED thread_id (e.g., "issue-1"), not the PR number
  insertMessage(db, { ...msg, threadId: mapping.thread_id });
} else {
  // Fallback: use PR number as thread_id (creates new session)
  insertMessage(db, { ...msg, threadId: String(event.issueNumber) });
}
```

## Test Scenarios

### Setup
- Fixer (CW1): 2 per-thread sessions (issue-1, issue-2)
- Reviewer (CW2): wired as A2A destination
- GitHub webhook configured for a test repo

### Scenario 1: A2A routing isolation (no webhook)
1. CW1/issue-1 sends to CW2 with thread_id="pr-1"
2. CW1/issue-2 sends to CW2 with thread_id="pr-2"
3. **Verify**: CW2 has 2 separate sessions (pr-1, pr-2)
4. CW2/pr-1 replies → **verify** it reaches CW1/issue-1 (not issue-2)
5. CW2/pr-2 replies → **verify** it reaches CW1/issue-2 (not issue-1)

### Scenario 2: Webhook → correct session (after fix)
1. CW1/issue-1 creates PR #100, calls `report_pr_created(repo, 100)`
2. Host records mapping: (repo, 100) → CW1/issue-1 thread_id
3. Simulate webhook: POST to webhook endpoint with PR #100 comment
4. **Verify**: webhook reaches CW1/issue-1 (not a new session)
5. **Verify**: CW1/issue-2 does NOT see the webhook

### Scenario 3: Webhook for unmapped PR (fallback)
1. Simulate webhook for PR #999 (no mapping exists)
2. **Verify**: creates new session with thread_id="999" (expected fallback)
3. **Verify**: no disruption to existing sessions

### Scenario 4: Multi-hop routing
1. CW1/issue-1 sends to CW2/pr-1 for review
2. CW2/pr-1 replies with review feedback → reaches CW1/issue-1
3. CW1/issue-1 updates the PR
4. Webhook fires for new review comment → reaches CW1/issue-1
5. CW1/issue-1 sends updated code to CW2/pr-1 for re-review
6. **Verify**: entire chain stays within the correct sessions

### Scenario 5: CW1/issue-1 talks to multiple destinations
1. CW1/issue-1 sends to CW2/pr-1: "Please review"
2. CW1/issue-1 sends to orchestrator: "Status update"
3. **Verify**: CW2 gets the review request (not the status update)
4. **Verify**: orchestrator gets the status (not the review request)

## Test Execution (using real GitHub)

### Create test fixtures
```bash
# Create a test issue on slangpy
gh issue create -R shader-slang/slangpy --title "[TEST] Webhook routing test" --body "Test issue for A2A routing validation"

# Create a test PR
cd /tmp && git clone --depth 1 https://github.com/shader-slang/slangpy.git test-pr
cd test-pr
git checkout -b dev/test-webhook-routing
echo "# test" > test-webhook-routing.md
git add . && git commit -m "test: webhook routing validation"
git push origin dev/test-webhook-routing
gh pr create -R shader-slang/slangpy --title "[TEST] Webhook routing" --body "Testing webhook → session routing" --base main
```

**IMPORTANT: Delete test issue + PR immediately after validation. No permanent artifacts.**

## Implementation Order

1. Add `pr_session_mappings` table (new migration)
2. Add `report_pr_created` MCP tool (container side)
3. Add delivery action handler (host side)
4. Update `webhook-github.ts` to check mapping
5. Run test scenarios 1-5
6. Clean up test fixtures

## Hardening Requirements

- PR→session mapping is write-once (first reporter wins — prevents a different session from hijacking)
- Mapping expires after 30 days (stale PR cleanup)
- Only the creating session can register a mapping (verified by session_id match)
- Webhook delivery logs which mapping was used (audit trail)
