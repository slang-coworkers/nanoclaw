import { describe, it, expect } from 'bun:test';

import { detectIssueClose } from './claude.js';

// detectIssueClose is the deterministic backstop behind the preToolUse hook:
// no coworker may close a GitHub issue. It must catch the two paths seen in
// the wild (#11719 closed via GraphQL closeIssue after REST state_reason 403'd)
// while leaving PR-close and ordinary issue reads/comments alone.

describe('detectIssueClose', () => {
  it('matches gh issue close', () => {
    expect(detectIssueClose('gh issue close 11719 -R shader-slang/slang')).toBe('gh issue close');
    expect(detectIssueClose('gh issue close 11719 --reason "not planned"')).toBe('gh issue close');
  });

  it('matches a GraphQL closeIssue mutation', () => {
    const cmd =
      'gh api graphql -f query=\'mutation { closeIssue(input: {issueId: "I_x", stateReason: DUPLICATE}) { issue { number } } }\'';
    expect(detectIssueClose(cmd)).toBe('GraphQL closeIssue mutation');
  });

  it('matches gh api PATCH that sets state/state_reason on an issue', () => {
    expect(detectIssueClose('gh api repos/shader-slang/slang/issues/11719 -X PATCH -f state=closed')).toBe(
      'gh api issues state change',
    );
    expect(
      detectIssueClose('gh api repos/shader-slang/slang/issues/11719 --method PATCH -f state_reason=not_planned'),
    ).toBe('gh api issues state change');
  });

  it('does NOT match PR close', () => {
    expect(detectIssueClose('gh pr close 123 -R shader-slang/slang')).toBeNull();
    expect(detectIssueClose('gh api graphql -f query=\'mutation { closePullRequest(input: {}) { } }\'')).toBeNull();
  });

  it('does NOT match issue reads, comments, or labels', () => {
    expect(detectIssueClose('gh issue view 11719 -R shader-slang/slang --comments')).toBeNull();
    expect(detectIssueClose('gh issue comment 11719 -b "looks like a dup of #11568"')).toBeNull();
    expect(detectIssueClose('gh api repos/shader-slang/slang/issues/11719/comments --method POST')).toBeNull();
    expect(detectIssueClose('gh issue list -R shader-slang/slang --state all')).toBeNull();
  });

  it('does NOT match a gh api state change on a non-issue path', () => {
    // pulls endpoint with state=closed must not be caught by the issues branch
    expect(detectIssueClose('gh api repos/shader-slang/slang/pulls/123 -X PATCH -f state=closed')).toBeNull();
  });

  it('handles empty / non-string input', () => {
    expect(detectIssueClose(undefined)).toBeNull();
    expect(detectIssueClose('')).toBeNull();
  });
});
