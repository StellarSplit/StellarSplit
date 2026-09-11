# Contributing to StellarSplit

Thank you for your interest in contributing to StellarSplit! We're building a tool that makes splitting bills effortless for everyone. Your contributions help solve a universal problem.

## Ways to Contribute

There are many ways to contribute to StellarSplit:

- **Bug Reports** - Help us identify and fix issues
- **Feature Requests** - Suggest new ideas and improvements
- **Code Contributions** - Submit pull requests for fixes or features
- **Documentation** - Improve guides, tutorials, and API docs
- **Design** - Enhance UI/UX and create assets
- **Testing** - Write tests and help with quality assurance
- **Translations** - Help make StellarSplit accessible worldwide
- **Mobile Testing** - Test on various devices and browsers

---

## GrantFox OSS Contributions

StellarSplit participates in **GrantFox** OSS Campaigns! This means you can earn rewards for contributing:

- Browse issues tagged `GrantFox OSS` and the active campaign name (e.g. `Third Campaign`)
- Apply to work on an issue through [GrantFox](https://contribute.grantfox.xyz)
- Complete the work and submit a PR against this repo, linking the issue it closes
- Rewards are reviewed by maintainers after the campaign ends — only completed, merged, reviewed work is eligible

**Important Notes:**

- Apply through GrantFox to be tracked for eligibility
- Issues must be tagged with the active campaign name
- Maintainers have final say on whether work resolves the issue
- Quality over speed - we value well-tested, documented contributions
- Rewards are not guaranteed for every contribution - see [GrantFox's Rewards docs](https://docs.grantfox.xyz/key-concepts/rewards) for how eligibility works

---

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/StellarSplit/StellarSplit
cd StellarSplit

# Add upstream remote
git remote add upstream https://github.com/StellarSplit/StellarSplit
```

### 2. Set Up Your Environment

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your .env with:
# - STELLAR_NETWORK=testnet (use testnet for development)
# - DATABASE_URL=your_postgres_connection
# - OPENAI_API_KEY=your_key (optional, for better OCR)
# - EXCHANGE_RATE_API_KEY=your_key (for currency conversion)

# Run database migrations
npm run migrate

# Start development servers (runs both frontend and backend)
npm run dev
```

The app will be available at:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

### 3. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch Naming Convention:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks
- `ui/` - UI/UX improvements

---

## Before You Start Coding

### Find or Create an Issue

- Check [existing issues](https://github.com/StellarSplit/StellarSplit/issues) to avoid duplication
- For bugs, search closed issues - it might already be fixed
- For new features, open an issue to discuss before implementing
- Comment on an issue to express interest or ask questions

### Good First Issues

Look for issues tagged with:

- `good-first-issue` - Great for newcomers
- `help-wanted` - We need community help
- `documentation` - Improve docs
- `ui-enhancement` - Visual improvements
- `GrantFox OSS` - Eligible for GrantFox campaign rewards

### Issue Application (for GrantFox)

If you're applying through GrantFox:

1. Apply via the GrantFox platform (not just GitHub comments)
2. Wait for maintainer approval before starting work
3. Only one contributor per issue
4. Respect the assignment - don't work on issues assigned to others
5. Communicate if you need more time or encounter blockers

---

## Smart Contract Contributions

StellarSplit includes Soroban smart contracts that handle on-chain escrow and payment logic. Contributing to contracts follows specific guidelines to ensure security and reliability.

### Contract Development Setup

```bash
# Navigate to contracts directory
cd contracts

# Install Rust and WebAssembly target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Soroban CLI (optional but recommended)
cargo install soroban-cli

# Run contract CI locally
bash scripts/ci-contracts.sh all
```

### Contract Contribution Process

#### 1. Understand Contract Status

Contracts have three status levels:

- **Production** (✅ CI Supported): Must pass all CI checks
- **Experimental** (❌ CI Excluded): Development phase, may have compilation issues
- **Archived**: No longer maintained

Check the current status in `contracts/README.md` or `docs/contract-ci.md`.

#### 2. Development Guidelines

**For New Contracts:**

1. Create contract directory under `contracts/`
2. Add to `contracts/Cargo.toml` members array
3. Implement with comprehensive tests
4. Follow Soroban best practices
5. Start as experimental (excluded from CI)

**For Existing Contracts:**

- **Production contracts**: Must maintain CI compatibility
- **Experimental contracts**: Fix issues to graduate to production

#### 3. CI Requirements

**Production contracts must pass:**

```bash
# All three checks must pass
bash scripts/ci-contracts.sh fmt    # Code formatting
bash scripts/ci-contracts.sh test   # Unit tests
bash scripts/ci-contracts.sh build  # WASM compilation
```

**Quality Standards:**

- Comprehensive unit tests with edge cases
- Proper error handling and validation
- Clear documentation and comments
- Follow Rust and Soroban conventions
- Use workspace dependencies when possible

#### 4. Graduation Process

To move a contract from experimental to production:

1. **Fix all compilation errors** - Clean build for `wasm32-unknown-unknown`
2. **Add comprehensive tests** - Good coverage of functionality
3. **Update CI script** - Add to `SUPPORTED_CONTRACTS` array in `scripts/ci-contracts.sh`
4. **Update documentation** - Status tables and README files
5. **Submit PR** - Include all changes and documentation updates

#### 5. Pull Requirements

Your contract PR should include:

- Contract source code with tests
- Updated `contracts/Cargo.toml` (if new contract)
- Updated `scripts/ci-contracts.sh` (if graduating to supported)
- Updated documentation:
  - `contracts/README.md`
  - `docs/contract-ci.md`
  - Contract-specific README if applicable

### Contract Testing

```bash
# Test specific contract
cd contracts/your-contract
cargo test

# Test with output
cargo test -- --nocapture

# Run specific test
cargo test test_function_name
```

### Resources

- **Contract CI Guide**: See `docs/contract-ci.md` for detailed documentation
- **Soroban Documentation**: https://soroban.stellar.org/docs/
- **StellarSplit Contracts**: `contracts/README.md`

### Common Issues

- **Compilation errors**: Check Soroban SDK version compatibility
- **WASM build failures**: Ensure `wasm32-unknown-unknown` target is installed
- **Test failures**: Verify test environment setup and dependencies

---

## Development Guidelines

### Code Style

We use automated tools to maintain code quality:

```bash
# Format code
npm run format

# Run linter
npm run lint

# Type check
npm run type-check
```

**Standards:**

- Use TypeScript for type safety
- Follow existing code patterns
- Write meaningful variable names
- Keep functions small and focused
- Add comments for complex logic
- Use functional components in React
- Prefer hooks over class components

### Mobile-First Development

Since StellarSplit is mobile-first:

- Test on actual mobile devices when possible
- Use Chrome DevTools mobile emulation
- Ensure touch targets are at least 44x44px
- Test on slow network connections
- Optimize images and assets for mobile
- Use responsive design patterns

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

[optional body]

[optional footer]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements

**Examples:**

```bash
feat(ocr): add OpenAI Vision API integration for better receipt scanning

fix(split): resolve incorrect tax distribution in itemized splits

docs(readme): add mobile testing instructions

test(payment): add integration tests for Stellar transactions

perf(camera): optimize image compression before upload
```

### Testing

All code contributions should include tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e
```

**Test Guidelines:**

- Write unit tests for new functions and components
- Add integration tests for API endpoints
- Test edge cases and error conditions
- Aim for >80% code coverage on new code
- Test mobile-specific functionality
- Test with different screen sizes

### Stellar Integration

When working with Stellar:

- **Use Testnet** for development (never use mainnet keys in code)
- **Test thoroughly** - blockchain transactions are irreversible
- **Handle errors** - Network issues, insufficient balance, etc.
- **Document** - Explain Stellar-specific logic clearly
- **Test edge cases** - Invalid addresses, failed transactions, etc.

```typescript
// Good: Proper error handling
try {
  const transaction = await sendPayment(recipient, amount);
  return { success: true, txHash: transaction.hash };
} catch (error) {
  if (error.code === "INSUFFICIENT_BALANCE") {
    return { success: false, error: "Not enough XLM" };
  }
  if (error.code === "INVALID_ADDRESS") {
    return { success: false, error: "Invalid Stellar address" };
  }
  throw error;
}
```

### OCR Development

When working with receipt scanning:

- **Test with real receipts** - Different formats, lighting conditions
- **Handle failures gracefully** - Allow manual entry as fallback
- **Provide feedback** - Show confidence scores, allow editing
- **Privacy-first** - Process locally when possible
- **Optimize images** - Compress before sending to API

---

## Pull Request Process

### 1. Ensure Quality

Before submitting:

- Code follows style guidelines
- All tests pass
- New tests added for new features
- Documentation updated
- No console.logs or debugging code
- Commits are clean and well-formatted
- Tested on mobile devices
- No TypeScript errors

### 2. Submit Pull Request

```bash
# Update your fork
git fetch upstream
git rebase upstream/main

# Push your changes
git push origin feature/your-feature-name
```

**PR Title Format:**

```
[Type] Brief description (#issue-number)
```

Examples:

- `[Feature] Add percentage-based split option (#42)`
- `[Fix] Resolve camera permission issue on iOS (#89)`
- `[UI] Improve payment link design (#15)`

### 3. PR Description Template

```markdown
## Description

Brief description of changes

## Related Issue

Closes #123

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] UI/UX improvement

## Testing

Describe how you tested your changes

## Mobile Testing

- [ ] Tested on iOS (version: \_\_\_)
- [ ] Tested on Android (version: \_\_\_)
- [ ] Tested on different screen sizes
- [ ] Tested camera functionality
- [ ] Tested on slow network

## Screenshots (if applicable)

Add screenshots for UI changes (mobile + desktop)

## Checklist

- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review
- [ ] I have commented complex code
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests
- [ ] All new and existing tests pass
- [ ] I tested on mobile devices
```

### 4. Review Process

- Maintainers will review your PR within 3-5 business days
- Address feedback by pushing new commits
- Don't force-push after review has started
- Be patient and respectful
- Once approved, maintainers will merge

### 5. After Merge

```bash
# Update your local repository
git checkout main
git pull upstream main

# Delete your feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

---

## Reporting Bugs

### Before Reporting

- Check [existing issues](https://github.com/StellarSplit/StellarSplit/issues)
- Try the latest version
- Test on different devices/browsers
- Search Discord/community channels

### Bug Report Template

```markdown
**Describe the bug**
Clear description of what the bug is

**To Reproduce**
Steps to reproduce:

1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable, especially for UI bugs

**Device Information:**

- Device: [e.g. iPhone 14, Samsung Galaxy S21]
- OS: [e.g. iOS 16.5, Android 13]
- Browser: [e.g. Safari, Chrome 120]
- Screen size: [e.g. 375x812]
- Network: [e.g. 4G, WiFi]

**Additional context**
Receipt scanning issue? Payment error? Wallet connection problem?
```

---

## Suggesting Features

### Before Suggesting

- Check if the feature already exists
- Review open feature requests
- Consider if it fits StellarSplit's scope (bill splitting focus)

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other solutions you've thought about

**Mobile Considerations**
How should this work on mobile? Any UI challenges?

**Additional context**
Mockups, examples, or references

**Would you like to implement this?**
Are you willing to contribute code?
```

---

## Documentation Contributions

Documentation is crucial for StellarSplit!

### What to Document

- API endpoints and usage
- Component props and behavior
- Setup and configuration
- OCR integration patterns
- Stellar payment flows
- Mobile-specific considerations
- Common issues and solutions

### Documentation Standards

- Use clear, simple language
- Include code examples
- Add screenshots for UI features
- Keep it up-to-date with code changes
- Use proper markdown formatting
- Test all instructions yourself

---

## Design Contributions

### UI/UX Improvements

- Follow mobile-first design principles
- Ensure responsive design (320px to 1920px)
- Maintain accessibility standards (WCAG 2.1 AA)
- Test on multiple devices and browsers
- Consider touch targets (minimum 44x44px)
- Optimize for one-handed use

### Design Assets

- Use SVG for icons when possible
- Optimize images (WebP format preferred)
- Follow color palette in design system
- Provide assets in multiple sizes (@1x, @2x, @3x for mobile)
- Consider dark mode support

### Mobile Design Guidelines

- **Thumb-friendly**: Important actions at bottom
- **Big buttons**: 44x44px minimum touch targets
- **Clear hierarchy**: Important info prominent
- **Progressive disclosure**: Hide complexity
- **Fast feedback**: Immediate visual response

---

## Translation Contributions

Help make StellarSplit accessible globally:

1. Check `src/locales/` for existing translations
2. Copy `en.json` as template
3. Translate all strings (keep context in mind)
4. Test in the app (especially on mobile)
5. Submit PR with new locale file

**Translation Guidelines:**

- Maintain tone (friendly, casual, helpful)
- Keep strings concise for mobile screens
- Test UI with longer translations
- Include currency symbols correctly
- Consider RTL support if applicable

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all.

### Our Standards

**Positive behavior:**

- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what's best for the community
- Showing empathy towards others
- Helping newcomers get started

**Unacceptable behavior:**

- Harassment or discriminatory language
- Trolling, insulting, or derogatory comments
- Public or private harassment
- Publishing others' private information
- Other unprofessional conduct

### Enforcement

Violations can be reported to maintainers at conduct@stellarsplit.app. All complaints will be reviewed and investigated promptly and fairly.

---

## Getting Help

**Stuck? Need clarification?**

- 💬 [Join our Discord](https://discord.gg/mpzbyTY6)
- 📧 Email: dev@stellarsplit.app
- 📖 [Documentation](https://docs.stellarsplit.app)

**For GrantFox-specific questions:**

- Visit the [GrantFox community chat](https://t.me/grantfoxcommunity)
- Read the [GrantFox Contributor Guide](https://docs.grantfox.xyz/user-manual-guides/oss-contributions-guide/contributor-guide)

**Common Questions:**

- Camera not working? Check browser permissions
- OCR not accurate? Try better lighting and flat surface
- Stellar transaction failing? Verify testnet/mainnet network
- Mobile issues? Check device compatibility list

---

## Recognition

Contributors will be:

- Listed in our [CONTRIBUTORS.md](CONTRIBUTORS.md) file
- Mentioned in release notes
- Featured in community spotlights
- Eligible for special contributor roles in Discord

**Top Contributors** get:

- Early access to new features
- Input on roadmap decisions
- Exclusive StellarSplit swag
- Recognition on our website
- Priority support

---

## License

By contributing to StellarSplit, you agree that your contributions will be licensed under the MIT License.

---

## Contribution Ideas

Not sure where to start? Here are some ideas:

**For Beginners:**

- Fix typos in documentation
- Improve error messages
- Add more test cases
- Update dependencies
- Improve accessibility

**For Intermediate:**

- Add new split methods
- Improve OCR accuracy
- Enhance mobile UI
- Add currency support
- Build new components

**For Advanced:**

- Optimize performance
- Implement PWA features
- Add offline support
- Build complex features
- Improve architecture

---

## Pro Tips

- **Start small** - Build confidence with simple issues first
- **Ask questions** - Better to clarify than assume
- **Test on real devices** - Mobile emulation isn't perfect
- **Document your code** - Future you will thank you
- **Learn from reviews** - Feedback helps you grow
- **Be patient** - Quality takes time
- **Have fun** - You're making bill splitting better for everyone!

---

## Final Notes

- **Quality over quantity** - We prefer well-tested, documented PRs
- **Mobile matters** - Always consider the mobile experience
- **Communication is key** - Ask questions, discuss approaches
- **Be patient** - Maintainers are often volunteers
- **Have fun** - We're solving a real problem together!

**Thank you for contributing to StellarSplit! Together, we're ending the awkward "who owes what" dance forever. 🌍💸**

---

_Last updated: September 2026_
