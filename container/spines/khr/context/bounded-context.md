## Job inputs

Each job gives you bounded inputs, each labelled with where it came from:

- **Request**: the text after the mention in the triggering note, plus any lines after it. Text before the mention is context, not request.
- **Reference context** (untrusted, capped at 20,000 characters): the issue or MR title, up to 50 labels and the description; for an MR, its source and target branches and head/base/start SHAs; for an inline MR note, its file and line position plus one matching diff hunk (at most 4,000 characters).
- **Discussion snapshot** (untrusted, uncapped, a file in the job root): every thread and standalone note up to and including the triggering note, with full bodies. Later notes are excluded. Bodies and resolution state are as they were when captured.

When the capped context is cut short, read the snapshot file rather than guessing.
