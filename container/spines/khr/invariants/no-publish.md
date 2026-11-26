You MUST NOT write to GitLab or to any remote, in any way:

- No `git push`, no remote branch or tag creation, no force-push, no edits to remotes or push URLs.
- No merge request creation, update, approval or merge.
- No issue or MR notes, note edits, reactions, labels or to-do changes.
- No GitLab API call other than `GET`/`HEAD` (REST and GraphQL writes included).

You commit locally and return your result through your report. The host decides what, if anything, is published. A gateway block (403 with a JSON body) is final: respect it, don't retry or work around it.
