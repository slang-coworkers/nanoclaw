import { describe, expect, it } from 'vitest';

import { mentionsHandle } from './github-mention.js';

const BOT = '@nv-slang-bot';

describe('mentionsHandle', () => {
  it.each([
    ['@nv-slang-bot please look', 'at the start'],
    ['Hey @nv-slang-bot, please look', 'followed by punctuation'],
    ['cc @nv-slang-bot', 'at the end'],
    ['(@nv-slang-bot)', 'inside parentheses'],
    ['Hey @NV-Slang-Bot take a look', 'in another case'],
    ['line one\n@nv-slang-bot on line two', 'on a later line'],
    ['@nv-slang-bot.', 'followed by a full stop'],
    ['```x``` @nv-slang-bot please look', 'after an inline triple-backtick span'],
  ])('matches %j (%s)', (body) => {
    expect(mentionsHandle(body, BOT)).toBe(true);
  });

  it.each([
    ['@nv-slang-bot-x please look', 'a longer login'],
    ['@nv-slang-bot2 please look', 'a login with a trailing digit'],
    ['@nv-slang-bot_x please look', 'a trailing underscore'],
    ['mail foo@nv-slang-bot.com', 'an email-like address'],
    ['see shader-slang/@nv-slang-bot', 'a path segment'],
    ['run `@nv-slang-bot review` to start', 'inline code'],
    ['```\n@nv-slang-bot review\n```', 'a fenced code block'],
    ['```ts\n@nv-slang-bot review\n```', 'a fenced code block with an info string'],
    ['~~~\n@nv-slang-bot review\n~~~', 'a tilde code fence'],
    ['```\n```not-a-close\n@nv-slang-bot review\n```', 'a fence after a line that cannot close it'],
    ['~~~\n~~~not-a-close\n@nv-slang-bot review\n~~~', 'a tilde fence after a line that cannot close it'],
    ['> @nv-slang-bot please fix\n\nThanks', 'a quoted line'],
    ['nv-slang-bot without the at sign', 'no @'],
    ['', 'an empty body'],
  ])('does not match %j (%s)', (body) => {
    expect(mentionsHandle(body, BOT)).toBe(false);
  });

  it('matches outside code even when the same text also appears inside code', () => {
    expect(mentionsHandle('`@nv-slang-bot` is the handle; @nv-slang-bot please look', BOT)).toBe(true);
  });

  it('accepts a configured handle without a leading @', () => {
    expect(mentionsHandle('Hey @nv-slang-bot', 'nv-slang-bot')).toBe(true);
  });

  it('treats regex metacharacters in the handle literally', () => {
    expect(mentionsHandle('Hey @a.b', '@a.b')).toBe(true);
    expect(mentionsHandle('Hey @axb', '@a.b')).toBe(false);
  });

  it('returns false for an empty handle', () => {
    expect(mentionsHandle('Hey @', '')).toBe(false);
  });
});
