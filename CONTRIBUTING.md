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

## Guidelines

- Keep things readable and follow existing conventions of code structure
- Comment the why, not the what; delete a comment that restates the code beneath it
- Delete code you make unreachable, there are no users to keep compatibility for yet
- Include tests for new backend behaviour and ensure all tests pass before submitting
- There is no migration tool, so if you change a model, say so in your PR: everyone testing it will need to recreate their database with `docker compose down -v`
- Update CHANGELOG.md with your changes

Thank you for contributing!
