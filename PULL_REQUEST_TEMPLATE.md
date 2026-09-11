<!--
Thanks for contributing to StellarSplit! Fill this out before requesting review —
it's also what maintainers use when deciding which merged PRs to submit for
GrantFox campaign rewards, so a complete description helps your work get seen.
-->

## Description

<!-- What does this PR do, in a sentence or two? -->

## Related Issue

Closes #

<!-- If this was picked up via GrantFox, keep the `GrantFox OSS` / campaign label on the issue linked above. -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] UI/UX improvement
- [ ] Smart contract change

## Package(s) Touched

- [ ] `/frontend`
- [ ] `/backend`
- [ ] `/contracts`
- [ ] `/ml-service`
- [ ] `/docs`

## Testing

<!-- How did you verify this? Which commands did you run? -->

```bash
# e.g. npm run test --prefix backend
```

## Mobile Testing (if frontend/UI changes)

- [ ] Tested on iOS (version: ___)
- [ ] Tested on Android (version: ___)
- [ ] Tested on different screen sizes
- [ ] Tested camera functionality (if receipt/OCR-related)
- [ ] Tested on slow network

## Contract Changes (if `/contracts` touched)

- [ ] `bash scripts/ci-contracts.sh fmt` passes
- [ ] `bash scripts/ci-contracts.sh test` passes
- [ ] `bash scripts/ci-contracts.sh build` passes
- [ ] Contract status (Production/Experimental) unchanged, or `docs/contract-ci.md` updated to reflect a status change

## Screenshots (if applicable)

<!-- Add before/after screenshots for UI changes — mobile + desktop -->

## Checklist

- [ ] My code follows the project's style guidelines (`npm run lint` passes)
- [ ] I have performed a self-review of my own code
- [ ] I have commented complex or non-obvious logic
- [ ] I have updated relevant documentation (README, `docs/`, or code comments)
- [ ] My changes generate no new warnings or TypeScript errors
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] I have not committed secrets, API keys, or `.env` files