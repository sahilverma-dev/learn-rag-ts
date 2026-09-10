# Taste
- Wants concise, direct answers when asked "just tell me" — avoid verbose narration or step-by-step debugging when the user wants the bottom line (e.g. name the single root cause immediately). Confidence: 0.8
- Wants code written to be testable — pure logic separated from I/O, with helper functions exported so they can be unit-tested rather than only exercised via a script's side effects. Confidence: 0.7
- Wants obvious file name typos fixed (e.g. renaming `pinecode.ts` → `pinecone.ts`) as part of code cleanups. Confidence: 0.8
- Prefers running models and supporting infrastructure self-hosted on their local network (e.g. Ollama for LLM + embeddings, a local Pinecone emulator) rather than depending on hosted cloud APIs. Confidence: 0.7
- Wants new capabilities wired through the whole stack, not left backend-only — when new server endpoints/pipelines are added, expects the client/UI to be updated to actually use them (e.g. "also change the client side to use local models"). Confidence: 0.6
- Prefers using the plain `git commit` command with author taken from global git config — no author name added manually in the commit message and no `Co-authored-by` trailer. Confidence: 0.95
