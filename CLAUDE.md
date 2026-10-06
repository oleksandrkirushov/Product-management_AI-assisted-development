# Products Audit

Застосунок із двох частин:

| Папка | Що це | Деталі |
|---|---|---|
| [FE/](FE/) | Фронтенд на Angular 22 | [FE/CLAUDE.md](FE/CLAUDE.md) |
| `BE/` | Бекенд (буде додано) | — |

Команди кожної частини запускай з її папки (`cd FE && ...`).

## Claude Code
- Скіли: [.claude/skills/](.claude/skills/)
  - `angular-best-practices` — правила Angular-коду
  - `test-karma-jasmine` — юніт-тести на Karma + Jasmine
- Агенти: [.claude/agents/](.claude/agents/)
  - `angular-developer` — реалізація фіч у фронтенді (`FE/`)
  - `angular-reviewer` — рев'ю змін у `FE/` за тим самим скілом (код не змінює)
  - `angular-test-writer` — покриття коду у `FE/` юніт-тестами на Karma + Jasmine (змінює лише `*.spec.ts`)
- Типовий цикл: `angular-developer` реалізує → `angular-test-writer` доповнює тести → `angular-reviewer` перевіряє → коміт.
- Опис архітектури та правила додавання: [.claude/README.md](.claude/README.md)
