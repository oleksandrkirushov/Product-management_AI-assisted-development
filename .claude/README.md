# Claude Code architecture: skills and agents

```
.claude/
├── README.md                 # this file
├── agents/                   # subagents (one .md file = one agent)
│   └── <agent-name>.md
├── skills/                   # skills (one folder = one skill)
│   └── <skill-name>/
│       ├── SKILL.md          # required: frontmatter + instructions
│       ├── references/       # optional: reference material the skill reads when needed
│       ├── scripts/          # optional: scripts the skill runs
│       └── assets/           # optional: file templates (e.g. component scaffolds)
└── templates/                # scaffolds for creating new skills/agents
    ├── agent.md              #   (Claude Code does NOT load them — they are only for copying)
    └── skill/
        └── SKILL.md
```

## Skills vs Agents

| | Skill | Agent (subagent) |
|---|---|---|
| What it is | A package of instructions/knowledge for a specific type of task | A separate worker with its own context, model and toolset |
| Where it runs | In the current conversation (adds instructions to the context) | In an isolated context, returns only the result |
| When to use | "How to do X in this project" — conventions, steps, templates | A self-contained multi-step task: review, tests, audit, research |
| Invocation | Automatically via `description` or `/skill-name` | Automatically via `description` or "use agent X" |

## Naming rules

- Names are `kebab-case`, Latin letters only.
- Skill folder = the `name` field in `SKILL.md`; agent file name = the `name` field in the frontmatter.
- Skills are grouped by prefixes (Claude Code does not support nested categories):
  - `angular-*` — Angular code generation (components, services, routing, forms)
  - `dotnet-*` — .NET backend code generation (Clean Architecture, EF Core, API)
  - `state-*` — state management (signals, NgRx, etc.)
  - `test-*` — unit and e2e tests
  - `style-*` — styles, UI kit, accessibility
  - `workflow-*` — processes: commits, releases, PRs
- `description` is the most important field: Claude uses it to decide when to load the skill/agent. Describe **what** it does and **when** to use it.

## How to add a new skill

```bash
cp -r .claude/templates/skill .claude/skills/angular-component
# edit name/description and the instructions in SKILL.md
```

## How to add a new agent

```bash
cp .claude/templates/agent.md .claude/agents/angular-reviewer.md
# edit name/description/tools/model and the system prompt
```

You can check that the agent was picked up with the `/agents` command in Claude Code.
