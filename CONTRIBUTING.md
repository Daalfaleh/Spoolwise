# Contributing to Spoolwise

Thank you for helping improve Spoolwise. Before starting substantial work, open an issue so the intended behavior and approach can be agreed upon.

## Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Install the Node.js version declared in `package.json` and run `npm ci`.
3. Copy `.env.example` to `.env.local` and provide development credentials.
4. Make a small, focused change with clear commit messages.
5. Run `npm run lint`, `npx tsc --noEmit`, and `npm test`.
6. Open a pull request that explains the problem, solution, verification, and any UI or migration impact.

## Quality expectations

- Preserve English and Arabic behavior, including RTL layouts.
- Keep authentication and database access owner-scoped.
- Never commit credentials, local databases, generated output, or customer data.
- Add or update tests when behavior changes.
- Include before/after screenshots for visible UI changes.
- Keep migrations additive and explain production rollout steps.

## Commit and pull-request style

Use concise imperative commit subjects, such as `Fix mobile quote navigation`. Keep refactors separate from behavior changes where practical. Pull requests should be reviewable, pass CI, and avoid unrelated formatting churn.
