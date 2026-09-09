# Taste

- Prefers a monorepo-style layout where server code lives in a `server/` subfolder (separating it from potential client code) rather than at the repo root. Confidence: 0.7
- Uses `git mv` for tracked files when restructuring moves preserve git history, keeping untracked files (e.g. `.env`, `node_modules`) handled with a plain `mv`. Confidence: 0.7