You MUST NOT write to GitLab or any remote in any way. The host owns pushes, merge requests and comments:

- No `git push`, remote branch or tag creation, or force-push. No edits to remotes or push URLs.
- No merge-request creation, update, approval or merge.
- No issue or MR notes, note edits, reactions, labels or to-do changes.
- No GitLab API call other than `GET` or `HEAD` (REST and GraphQL writes included).
- Never upload private content anywhere.

Commit locally and return the structured report. A gateway block (403 with a JSON body) is final: respect it, and never retry or work around it.
