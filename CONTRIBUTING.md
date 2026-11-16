# Contributing to Stream Clip Maker

Thanks for your interest in contributing! Bug reports, documentation improvements, tests, and focused feature changes are all welcome.

## Before you start

- Check the [open issues](https://github.com/aplicandola-ia/chat-clips/issues) to see whether the work is already planned.
- Issues labeled **good first issue** are intended as approachable starting points. The **help wanted** label marks work where contributions are especially welcome.
- For a substantial change, open an issue first so we can agree on the approach before you spend time implementing it.
- If you want to work on an issue, leave a comment so others know it is being handled. You do not need to wait for assignment unless the issue says otherwise.

## Development setup

Requirements:

- Node.js 18 or newer
- pnpm (the repo pins its version in `packageManager`)
- Git
- FFmpeg for features or tests that inspect, cut, or render video

Clone the repository and install dependencies:

```bash
git clone https://github.com/aplicandola-ia/chat-clips.git
cd chat-clips
pnpm install --frozen-lockfile
```

Run the project's safe checks:

```bash
pnpm test
```

You can also inspect the command-line help:

```bash
node cli.mjs --help
node chat-clips.mjs --help
```

The core chat-analysis workflow can be developed and tested without Twitch or YouTube credentials. External downloaders and media tools are only needed for the workflows that use them.

## Making a change

1. Create a focused branch from the current `main` branch.
2. Keep the change scoped to one bug, feature, or documentation improvement.
3. Add or update tests when behavior changes.
4. Update the README or command help if users will notice a new option or behavior.
5. Run `pnpm test` before opening a pull request.
6. Review your diff to make sure it contains only the intended files.

Prefer small, readable changes. Avoid introducing new dependencies unless they provide clear value and are justified in the pull request.

## Tests and safety

- Tests must be deterministic and runnable offline wherever practical.
- Use small fixtures; do not depend on a live Twitch stream, a real VOD download, or a YouTube account.
- Tests must not upload, publish, or modify real creator content.
- Do not make the test suite render full videos or start long-running media jobs as a side effect.
- If a feature needs external tools, make missing-tool behavior clear and provide a safe way to skip integration coverage when appropriate.
- Never cancel a user's real clip-rendering job as part of testing or troubleshooting.

## Pull request checklist

In your pull request, please include:

- A short description of the problem and the proposed solution.
- The related issue number, if one exists.
- Steps to reproduce the bug or verify the feature.
- The commands you ran and whether they passed.
- Screenshots or short sample output for user-facing changes, when useful.

Please disclose known limitations and platform-specific behavior. Do not claim a test passed if it was not run.

## Security, privacy, and creator rights

Never commit or attach:

- API keys, access tokens, OAuth files, client secrets, or populated `.env` files.
- Private chat logs, personal data, or private recordings.
- Copyrighted videos, audio, or other media unless you have permission to share them.

Use placeholders in examples and keep credentials in local, ignored configuration files. Finding a public stream or VOD does not grant permission to download, edit, redistribute, or publish its content.

Stream Clip Maker is review-first: contributions must not silently publish videos or bypass explicit user confirmation. Keep upload and publishing behavior private-by-default and preserve the user's control over final publication.

## Code of conduct

Be respectful, constructive, and welcoming. Assume good intent, explain disagreements clearly, and focus feedback on the work rather than the person. Harassment and discriminatory behavior are not acceptable.

## Questions?

If you are unsure about an issue or implementation approach, ask in the relevant [GitHub issue](https://github.com/aplicandola-ia/chat-clips/issues). Thanks for helping make Stream Clip Maker better!
