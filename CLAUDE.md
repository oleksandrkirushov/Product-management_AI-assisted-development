# Products Audit

An application with two parts:

| Folder | What it is | Details |
|---|---|---|
| [FE/](FE/) | Angular 22 frontend | [FE/CLAUDE.md](FE/CLAUDE.md) |
| [BE/](BE/) | ASP.NET Core 10 backend (Clean Architecture) | — |

Run each part's commands from its folder (`cd FE && ...`, `cd BE && ...`).

## Claude Code
- Skills: [.claude/skills/](.claude/skills/)
  - `angular-best-practices` — Angular code rules
  - `test-karma-jasmine` — Karma + Jasmine unit tests
  - `dotnet-clean-architecture` — backend Clean Architecture conventions (`BE/`)
  - `git-commit` — rules for creating git commits (no AI attribution)
- Agents: [.claude/agents/](.claude/agents/)
  - `angular-developer` — implements features in the frontend (`FE/`)
  - `angular-reviewer` — reviews changes in `FE/` against the same skill (doesn't change code)
  - `angular-test-writer` — covers code in `FE/` with Karma + Jasmine unit tests (changes only `*.spec.ts`)
  - `dotnet-developer` — implements features in the backend (`BE/`)
  - `dotnet-reviewer` — reviews changes in `BE/` against the `dotnet-clean-architecture` skill (doesn't change code)
- Typical FE cycle (run by the main session; subagents don't call each other):
  1. `angular-developer` implements the task.
  2. `angular-test-writer` adds tests for the implemented code.
  3. `angular-reviewer` checks the result and returns a verdict (✅ / ⚠️ / ❌).
  4. If the verdict is ⚠️ or ❌ (there are 🔴/🟡 findings) — the findings are passed back to `angular-developer` for fixing
     (and findings about tests — to `angular-test-writer`), then `angular-reviewer` runs again. The cycle repeats
     until the verdict is ✅ (roughly up to 3 iterations; if the problem doesn't go away — stop and describe it
     to the user instead of trying forever).
  5. When the verdict is ✅ — the result (list of changes, review report) is shown to the user. A commit is made only after
     the user's explicit confirmation; nothing is committed automatically in the cycle.
- Typical BE cycle (run by the main session; subagents don't call each other):
  1. `dotnet-developer` implements the task (together with tests).
  2. `dotnet-reviewer` checks the result and returns a verdict (✅ / ⚠️ / ❌).
  3. If the verdict is ⚠️ or ❌ (there are 🔴/🟡 findings) — the findings are passed back to `dotnet-developer` for fixing,
     then `dotnet-reviewer` runs again. The cycle repeats until the verdict is ✅ (roughly up to 3 iterations;
     if the problem doesn't go away — stop and describe it to the user instead of trying forever).
  4. When the verdict is ✅ — the result (list of changes, review report) is shown to the user. A commit is made only after
     the user's explicit confirmation; nothing is committed automatically in the cycle.
- Architecture description and rules for adding new items: [.claude/README.md](.claude/README.md)
