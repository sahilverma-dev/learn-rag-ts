/**
 * Splits text into word-sized tokens that keep their trailing whitespace, so
 * joining a prefix reproduces the original text exactly and markdown structure
 * (newlines, indentation, block markers) survives a progressive reveal.
 *
 * The leading whitespace run becomes its own token so an indented first line is
 * not lost. Note that splitting on /\s+/ and rejoining with " " — the naive
 * approach — destroys every newline, which makes markdown impossible to render.
 */
export function tokenize(text: string): string[] {
  return text.match(/\s+|\S+\s*/g) ?? [];
}
