# Prompt Playbook

Templates and habits distilled from the [Fable 5 Tips and Review] session (2026-07-11). These are for **me** (Jose) when prompting Claude Code — not instructions for Claude.

## The seven habits that matter most

1. **Stop pixel-tweaking through the model.** Ask for the knob: "Tell me the exact file and line where the gap value lives, set it to 16px, and I'll fine-tune with hot reload." Batch remaining nudges into one numbered message. Use a cheaper/faster model for polish sessions; save the big model for features, bugs, schema, security.
2. **Every UI prompt names three coordinates**: Screen (+ component file), Element, Change (with a number or an anchor: "identical to X on the Y screen"). Use the element selector/screenshot annotation.
3. **Second failed fix = root-cause mode** (template below). Never say "fix it" a third time.
4. **Commit per verified change.** "commit" is a complete prompt — Claude writes the message from the diff.
5. **Big features use the spec template** below. Fuzzy specs get the interview pattern first.
6. **Multi-session work gets a plan file** in `docs/plans/<feature>.md` with phase checkboxes. Next session: "Read docs/plans/x.md. Phase 2 done. Start phase 3."
7. **Fresh session per task.** New feature → new session. Unrelated topic → /clear.

## Templates

### Bug report
```
BUG: [screen + component file if known]
Steps: 1) ... 2) ... 3) ...
Expected: [with numbers: "180 cal at 50g"]
Actual: [what happens instead]
Started after: [commit/feature if known]
Diagnose first and explain the root cause. Don't change code until I confirm.
```

### UI change
```
Screen: [name] ([File.js])
Element: [what, precisely]
Change: [number or anchor: "same as X on Y screen"]
Targeted edit only. If adjacent code should also change, flag it — don't change it.
```

### Repeat-failure escalation (after any fix fails twice)
```
The [symptom] fix didn't work — this is attempt N. Do NOT write a fix yet.
1. Read [File.js] and list every code path that could cause [symptom].
2. List each previous fix attempt from git history and why it didn't work.
3. Add temporary console.log instrumentation to the relevant handlers.
   I'll reproduce on my phone and paste the console output back.
4. Only propose a fix after we've seen the logs.
```

### Feature spec
```
This is a large feature. Make decisions independently based on existing
patterns. Don't ask clarifying questions mid-build — make a reasonable choice
and flag it at the end. Only stop if a schema change is needed beyond what
this prompt defines.

GOAL: [one sentence — what the user can do when this ships]

SCHEMA (design and apply first):
- New table X — columns... follow the CLAUDE.md table-creation steps exactly
  (cascade FK, CRUD-only grants, RLS).

SCREENS / BEHAVIOR:
- [screen 1]: ... (anchor: "identical to the hour picker pattern")
- [screen 2]: ...

OUT OF SCOPE: [what NOT to build — future session will add ...]

PHASES: schema → phase 1 → phase 2.
CI=true npm run build after each phase. Commit after each phase passes.
Write the plan to docs/plans/<feature>.md and check phases off as they land.
```

### Interview pattern (fuzzy spec)
```
Before writing any code, ask me every question you need to make this spec
unambiguous. Then restate the full spec back to me for approval.
```

### Refactor / extraction
```
Refactor session — no behavior changes, no styling changes, extraction only.
Split [File.js] into: [list target files and what moves].
After each extraction: CI=true npm run build, then commit that extraction alone.
List every extracted component and its new file at the end.
```

### Audit / investigation
```
Do not change anything. [Search for X / trace Y]. Report every file and line,
grouped by [category], ranked by severity.
```

### Schema / security work
```
[The change.] Design the security model first, before any code.
Then run the RLS Audit Scenarios from CLAUDE.md against this change and
report each answer explicitly. Present migration SQL for approval before
touching the database.
```

## Small habits

- Approvals against old options: restate the referent — "Apply fix 2 (the serving-size snapshot one)", not "2".
- After any fix: "list every file you changed and the specific behavior difference."
- After schema work: "query pg_proc to confirm the live signature."
- When an explanation smells wrong: "Show me the exact code path that causes this before you change anything."
- Don't resend a prompt that seems stalled — check whether the first is still running (double git pushes have happened).
- Small tweaks batch together in one session; anything needing a schema change, a new file, or a new interaction pattern gets its own session and the feature template.
