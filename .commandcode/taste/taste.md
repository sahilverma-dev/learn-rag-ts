# Taste

- Wants concise, direct answers when asked "just tell me" — avoid verbose narration or step-by-step debugging when the user wants the bottom line (e.g. name the single root cause immediately). Confidence: 0.8
- Wants code written to be testable — pure logic separated from I/O, with helper functions exported so they can be unit-tested rather than only exercised via a script's side effects. Confidence: 0.7
- Wants obvious file name typos fixed (e.g. renaming `pinecode.ts` → `pinecone.ts`) as part of code cleanups. Confidence: 0.8
- Prefers using the plain `git commit` command with author taken from global git config — no author name added manually in the commit message and no `Co-authored-by` trailer. Confidence: 0.95
