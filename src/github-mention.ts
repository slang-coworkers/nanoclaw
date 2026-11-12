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
 * indented code block, still count as prose. The whole check runs in time
 * linear in the body length, because any GitHub user can send the body.
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
    out.push(stripCodeSpans(line));
  }
  return out.join('\n');
}

/**
 * Replace each inline code span in `line` with a space, in time linear in the
 * line length. A span opens at a run of backticks and closes at the next run of
 * exactly the same length (CommonMark); an opener with no such closer is
 * literal text. An escaped backtick is literal and never opens a span; an even
 * run of backslashes escapes itself, so the backtick after it still does.
 *
 * Consider `` `a`` @bot ``: the one-backtick opener has no one-backtick closer
 * (`` `` `` is a different run), so the text stays prose and the mention counts,
 * as GitHub renders it. A backtracking pattern such as `` (`+)[\s\S]*?\1 `` both
 * closes on part of a longer run and takes quadratic time on a long run of
 * backticks, which any commenter can send; this scanner visits each run once.
 */
function stripCodeSpans(line: string): string {
  if (!line.includes('`')) return line;
  // Each maximal run of backticks: where it starts, its length as a closer,
  // and its length as an opener (one less when its first backtick is escaped).
  const runs: { start: number; end: number; openLen: number }[] = [];
  for (let i = 0; i < line.length;) {
    if (line[i] !== '`') {
      i++;
      continue;
    }
    let end = i;
    while (end < line.length && line[end] === '`') end++;
    let slashes = 0;
    while (i - slashes - 1 >= 0 && line[i - slashes - 1] === '\\') slashes++;
    runs.push({ start: i, end, openLen: end - i - (slashes % 2) });
    i = end;
  }
  // For each run, the index of the next run whose length equals its opener
  // length, found in one right-to-left pass.
  const closer: (number | undefined)[] = new Array(runs.length);
  const nearestByLen = new Map<number, number>();
  for (let k = runs.length - 1; k >= 0; k--) {
    if (runs[k].openLen > 0) closer[k] = nearestByLen.get(runs[k].openLen);
    nearestByLen.set(runs[k].end - runs[k].start, k);
  }
  let result = '';
  let copied = 0;
  for (let k = 0; k < runs.length; k++) {
    const c = closer[k];
    if (c === undefined) continue;
    const openStart = runs[k].end - runs[k].openLen;
    result += line.slice(copied, openStart) + ' ';
    copied = runs[c].end;
    k = c;
  }
  return result + line.slice(copied);
}
