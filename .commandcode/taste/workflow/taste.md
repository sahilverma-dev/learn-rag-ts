# Taste

- Prefers a monorepo-style layout where server code lives in a `server/` subfolder (separating it from potential client code) rather than at the repo root. Confidence: 0.7
- Uses `git mv` for tracked files when restructuring moves preserve git history, keeping untracked files (e.g. `.env`, `node_modules`) handled with a plain `mv`. Confidence: 0.7
- Wants conventional commit messages that include the author's name after making meaningful progress (e.g. `feat(server): ...` followed by the author's name in the body). Confidence: 0.8
- Explicitly does NOT want the `Co-authored-by: CommandCodeBot <noreply@commandcode.ai>` trailer on commits — never include it. Confidence: 1.0
- Prefers a "light adapt" when porting a reference UI/design: reuse dependencies already in the project and avoid pulling heavy/external packages (e.g. shader/animation libs, icon packs) just to match a visual reference. Confidence: 0.6
- Wants commits made at logical milestones as progress accumulates (conventional commit format, user as author), rather than delaying everything into one giant commit at the end. Confidence: 0.9
- Prefers to run long-running or environment-dependent operations (e.g. the full re-embedding pipeline) themselves — expects to be handed the exact command to run rather than having the agent execute it. Confidence: 0.65