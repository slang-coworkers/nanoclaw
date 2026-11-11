/**
 * Does a GitHub comment or review body @-mention `handle` as GitHub itself
 * would? Only an exact-word mention starts bot work, so a substring match is
 * not enough: it also fires on a longer login (`@nv-slang-bot-x`), an
 * email-like string, and a handle someone quoted or put in a code sample.
 *
 * Text inside fenced code blocks, inline code and `>` quoted lines is ignored:
 * code shows the handle without addressing the bot, and a quote repeats an
 * earlier request (GitHub's "Quote reply"), which must not start the work again.
 * Known limits: an inline code span that crosses a line break, and a 4-space
 * indented code block, still count as prose.
 */
export function mentionsHandle(body: string, handle: string): boolean {
  const login = handle.trim().replace(/^@/, '');
  if (!login || !body) return false;

  const prose = stripNonProse(body);
  const escaped = login.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // GitHub logins are letters, digits and hyphens: a following one of those
  // (or `_`) means a different, longer name. A preceding word char, `.`, `/` or
  // `-` means the `@` is inside an address or a path, not a mention.
  const re = new RegExp(`(?<![\\w./-])@${escaped}(?![\\w-])`, 'i');
  return re.test(prose);
}

function stripNonProse(body: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    // A backtick fence's info string cannot contain a backtick (CommonMark), so a
    // line starting with an inline span such as ```x``` is prose, not a fence.
    const marker = /^\s{0,3}(`{3,}(?!.*`)|~{3,})/.exec(line)?.[1];
    if (fence) {
      // A closing fence carries nothing but optional trailing spaces.
      const closing = /^\s{0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (closing && closing[0] === fence[0] && closing.length >= fence.length) fence = null;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) continue;
    // An escaped backtick is literal text and never opens a span; an even run
    // of backslashes escapes itself, so the backtick after it still does.
    out.push(line.replace(/(?<!\\)(?:\\\\)*(`+)[\s\S]*?\1/g, ' '));
  }
  return out.join('\n');
}
