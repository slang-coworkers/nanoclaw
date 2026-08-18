---
title: "slang GitHub: REST label-add can 403 'admin rights' while GraphQL addLabelsToLabelable succeeds"
type: learning
topic: slang-compiler
source: learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md
---

# slang GitHub: REST label-add can 403 "admin rights" while GraphQL addLabelsToLabelable succeeds

When applying a label to a shader-slang/slang issue as nv-slang-bot, the REST endpoints `POST /issues/{n}/labels` and `PATCH /issues/{n}` can return `403 "Must have admin rights to Repository."` even though the label exists and Issue-Type setting via GraphQL `updateIssue` works in the same session.

**Workaround (verified 2026-06-26 on #11781):** use the GraphQL `addLabelsToLabelable` mutation instead — it succeeded where REST 403'd.

```bash
ISSUE_NODE=$(gh api repos/$REPO/issues/$N --jq '.node_id')
LABEL_NODE=$(gh api repos/$REPO/labels/<label-name> --jq '.node_id')
gh api graphql -f query='mutation($lbl:ID!,$lblable:ID!){addLabelsToLabelable(input:{labelableId:$lblable,labelIds:[$lbl]}){labelable{... on Issue{labels(first:10){nodes{name}}}}}}' -f lbl="$LABEL_NODE" -f lblable="$ISSUE_NODE" --jq '.data.addLabelsToLabelable.labelable.labels.nodes[].name'
```

Also note: in this container `gh auth status` reports the GH_TOKEN as invalid, but `gh api` (REST + GraphQL read/most writes) works fine — don't trust `gh auth status`, and use `gh api` rather than `gh issue view` (which silently returned empty output).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md`_
