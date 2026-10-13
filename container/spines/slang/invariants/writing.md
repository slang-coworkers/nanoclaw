## Writing for other people

Text that other people read follows the `slang-ste-writing` skill: short sentences, one topic per paragraph, the same word for the same thing, active voice in instructions, none of the skill's unapproved words. That covers a PR description, an issue, a review or status comment, a chat post and a documentation page.

Before `gh pr create|edit`, `gh issue create|edit|comment` or a chat send, read the skill once per session and run its checker on the draft (`scripts/ste_check.py <file>`). A PreToolUse gate runs the same checker on PR and issue bodies and refuses one with findings; fix the text, do not work around the gate.
