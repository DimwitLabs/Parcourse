# Contributing to Parcourse

Thank you for your interest in contributing to Parcourse!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch following our branch naming conventions (see below)
4. Make your changes and test them
5. Commit using conventional commits (see below)
6. Submit a Pull Request

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

Examples:
```
feat(settings): add per-user provider connections
fix(quiz): resolve theory answers scoring as zero
chore(cleanup): remove the unused storyboard feature
docs: update installation instructions
```

## Branch Naming

Branch names follow the same convention as commits:

```
<type>/<short-description>
```

Examples: `feat/add-provider-form`, `fix/graph-cleanup`, `docs/update-readme`

## Development

You need Docker. Nothing else has to be installed locally.

```bash
# Copy the environment template and start everything
cp .env.example .env
docker compose up

# Run the backend tests
docker compose exec backend python -m unittest discover -s tests

# Typecheck and build the frontend
docker compose exec frontend npm run build
```

The app runs on http://localhost:5173, the API on http://localhost:8000, and interactive API docs on http://localhost:8000/docs. Both containers mount your working copy, so edits reload without a rebuild.

To use anything AI-powered you need a key from a provider. The first run walks you through it, or you can add one later from Settings.

The landing page shares its palette with the app, so run `./scripts/sync-tokens.sh` before previewing `landing/index.html`.

## Guidelines

- Keep things readable and follow existing conventions of code structure
- Comment the why, not the what; delete a comment that restates the code beneath it
- Delete code you make unreachable rather than leaving it behind a flag
- Include tests for new backend behaviour and ensure all tests pass before submitting
- Colours live as tokens in the `:root` block of `styles.css`, each holding both its light and dark value through `light-dark()`; add a colour there rather than inline
- Update CHANGELOG.md with your changes

## Contribution Terms

Parcourse is licensed under the GNU Affero General Public License v3.0, and contributions are accepted under the same licence.

By submitting a pull request you confirm that the contribution is your own work and that you have the right to submit it. If your employer holds rights to work you create, you confirm you have their permission to contribute it.

You also grant Deepansh Khurana and Dimwit Labs a perpetual, worldwide, non-exclusive, royalty-free, irrevocable licence to use, reproduce, modify, distribute and sublicense your contribution, under the AGPL-3.0 and under other licence terms, together with a licence to any patent claims of yours that the contribution necessarily infringes.

You keep the copyright in what you wrote and stay free to use it anywhere else. This grant exists so the licence can change in future without tracking down every past contributor. If you would rather not agree to it, open an issue describing the change instead of a pull request.

Thank you for contributing!
