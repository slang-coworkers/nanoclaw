### Review against the maintainer's ask, not only the diff

Apply when the PR under review implements design direction a maintainer gave on its issue or PR (slang-reviewer).

- Fetch that direction yourself from the linked issue and PR; the review request's `Maintainer direction:` links are a starting point, not the list. Build your own list from the comments, each requirement with its comment link — never from the fixer's summary.
- Compare your list and verdicts with the fixer's `Fixer self-check:`. Where they disagree, say so: that disagreement is a finding.
- The verdict reports every requirement as met, partial or missed, with the `file:line` that shows it. Correctness and behavior preservation are necessary, not sufficient.
- A missed requirement means `REQUEST_CHANGES`, whatever the correctness findings say. Never file it as a nit or a "should-address before merge" gap.
