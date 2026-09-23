### Code-comment discipline

Apply when writing or reviewing Slang code (writers, fixer, reviewer; readers can ignore).

- **Comment only when it adds value.** A comment must explain *why* — non-obvious intent, an invariant, a subtle edge case, a reference to the issue/spec it satisfies. Do not restate what the code already says; a comment that paraphrases the next line is noise, not documentation. When in doubt, prefer clearer code over a comment.
- **Be concise.** One or two lines at the point that needs it. No decorative banners, no changelog narration in the source, no "added by" markers.
- **Commit message ≠ code comment — keep them separate.** The commit message records *what changed and why* for the history; a code comment documents the code as it stands now for the next reader. Never migrate commit-message prose (what this PR did, before/after, "fixes X") into source comments, and never leave a comment that only makes sense while reviewing this diff. Each is written for its own audience.
- **Design rationale goes in the PR body, not source.** Soundness arguments, experiments you ran to convince yourself, and why-you-rejected-an-alternative belong in the PR description — where a reviewer wants them and where they don't rot in the code. Fresh-reader test before keeping any comment: *would someone seeing this code with no PR and no memory of writing it be confused without the comment?* If no, delete it.
- **Declarative voice, authorial "we".** "We cache the declared mode because…", not the imperative "Cache the mode…".
- **Contracts live on the declaration.** State a function's preconditions and assumptions where it is declared, and assert them where you can. Do not narrate "this runs at the end of signature checking" inside the body: a routine does not control where it is called from.
- **Architecture at the scope it governs.** Rationale for a mechanism goes on the type or attribute that embodies it (or in the PR description), not inside one function that happens to use it.
- **Flat control flow.** Handle the early-out cases first and return; keep the main path unnested.
- **Name a repeated predicate.** The second time a condition appears, factor it into a well-named helper next to the type it tests instead of copying it.
