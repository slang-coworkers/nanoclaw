/**
 * Continuing an OpenCode turn whose last step was cut off at the output token
 * limit.
 *
 * OpenCode runs a turn as a loop of model calls ("steps") and keeps looping
 * while a step ends in tool calls. A step that hits the response budget ends
 * with finish reason `length`, and OpenCode usually stops the loop there and
 * returns that step as the turn's answer. That answer is cut off, often with
 * no text at all.
 *
 * Consider slang-fixer on prod on 2026-11-16. It was working on
 * shader-slang/slang#14494 when a GLM 5.3 step reasoned for 4095 tokens and
 * stopped with `length`. The turn ended with no output. The poll loop then
 * asked the model to "re-send your answer", so the model posted a status
 * message, ended with `stop`, and the trigger was acked `completed`. The fix
 * stopped for four hours with nothing left to wake it. The 4096 cap came from
 * the endpoint ignoring `max_tokens` (#2409 sends `max_completion_tokens`
 * instead), but a step can still exceed the larger budget.
 *
 * Claude Code handles this case inside its own query loop: it sends a fixed
 * note asking the model to resume where it was cut off, a small bounded
 * number of times, and the turn still ends in one result. The OpenCode
 * provider does the same. It sends `OUTPUT_LIMIT_CONTINUE_PROMPT` in the same
 * session, at most `MAX_OUTPUT_LIMIT_CONTINUES` times per turn, and charges
 * every step with the turn's single `usage`. As with a model-error retry
 * (opencode-retry.ts), it does not resend the prompt, because OpenCode keeps
 * the prompt and every completed step in the session history.
 */

/** OpenCode's finish reason for a step cut off at the output token limit. */
export const OUTPUT_LIMIT_FINISH = 'length';

/**
 * The most continues one turn sends after cut-off steps. A turn that is still
 * cut off after them ends as before, and the poll loop's silent-turn handling
 * takes over.
 */
export const MAX_OUTPUT_LIMIT_CONTINUES = 3;

/** The note sent in place of the prompt to continue a cut-off turn. */
export const OUTPUT_LIMIT_CONTINUE_PROMPT =
  '[System: your last response reached the output token limit and was cut off before it finished. ' +
  'This is an automatic continuation. Continue the request above from where you were cut off, with no ' +
  'apology and no recap. A tool call that was cut off did not run, so make it again. Keep each response ' +
  'shorter: reason briefly and split long content across several smaller steps. Do not repeat a step that ' +
  'already completed above: do not send a message, post a comment or push a commit a second time.]';
