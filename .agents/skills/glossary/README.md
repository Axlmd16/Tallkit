# Glossary Skill Reference

The `glossary` skill helps teams keep project terminology consistent across
proposals, requirements, specifications, design documents, ADRs, and task plans.

This page explains the files the skill uses and the output you should expect to
see when it is applied.

## Glossary Files

Glossary files live at the project root:

| File | Purpose |
| --- | --- |
| `glossary/business.md` | Domain, product, workflow, and business terms. |
| `glossary/technical.md` | Architecture, implementation, platform, and protocol terms. |

Example:

```markdown
| Term | Definition | Use When | Avoid |
| --- | --- | --- | --- |
| Account | A registered customer identity that owns profile, billing, and access settings. | Referring to the customer identity in product workflows. | Using for a bank account, login session, or internal staff user. |
```

Use glossary entries for project-specific language. Avoid generic dictionary
words and one-off implementation details.

## Framework Usage

The glossary skill is framework-agnostic. It can be used with any documentation,
specification, planning, or requirements workflow where terminology consistency
matters.

For OpenSpec projects, require it from `openspec/config.yaml`:

```yaml
rules:
  proposal:
    - Must use glossary skill
```

You can also require it for other OpenSpec stages, such as `design`, or
`spec`, when those artifacts should be checked against the glossary.
