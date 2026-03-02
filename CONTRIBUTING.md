# Contributing to VDK CLI

Thank you for considering contributing to VDK CLI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Testing Guidelines](#testing-guidelines)
4. [Code Style](#code-style)
5. [Pull Request Process](#pull-request-process)
6. [Adding New Features](#adding-new-features)

## Getting Started

Before you begin contributing, please:

1. Familiarize yourself with the [VDK CLI Guide](./GUIDE.md)
2. Check the [Issues](https://github.com/vdkit/VDK-CLI/issues) for open tasks or create a new issue to discuss your proposed changes.

## Development Setup

To set up a local development environment:

```bash
# 1. Clone the repository
git clone https://github.com/vdkit/VDK-CLI.git
cd VDK-CLI

# 2. Install dependencies
npm install

# 3. Link the package for local development
npm link

# 4. Verify the installation by running the help command
vdk --help
```

Now, any changes you make to the source code will be immediately reflected when you run the `vdk` command.

## Testing Guidelines

We maintain high code quality standards. Please follow these guidelines:

- All new features should be thoroughly tested manually.
- Bug fixes should include verification that the issue is resolved.

### Manual Testing

Test your changes in a separate test project:

1. **Initialize VDK**: Run `vdk init` inside a test project and follow the prompts.
2. **Check Status**: Run `vdk status` to ensure the configuration is correct.
3. **Validate Changes**: Ensure your changes work as expected and do not introduce any regressions.

## Code Style

We follow a consistent code style across the project:

- Use ESLint and follow the project's `.eslintrc` configuration.
- Write clear, self-documenting code with meaningful variable and function names.
- Include JSDoc comments for all public API functions.
- Follow the existing project structure and patterns.
- Use modern JavaScript features (ES modules, async/await, etc.).

## Pull Request Process

1. **Fork the repository** and create a new branch for your feature or bug fix.
2. **Make your changes** and ensure they adhere to the code style and testing guidelines.
3. **Commit your changes** with a clear and descriptive commit message.
4. **Push your branch** to your forked repository.
5. **Submit a Pull Request** to the `main` branch of the original repository.

### PR Description Template

```markdown
## Description

Brief description of the changes in this PR.

## Related Issue

Fixes #[issue number]

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing

Describe the manual testing performed to verify your changes.
```

## Adding New Features

When adding new features to VDK CLI:

1. **Discuss First**: Create an issue to discuss your proposed feature before implementation.
2. **Follow the Architecture**: Understand and follow the existing architecture and design patterns.
3. **Update Documentation**: Update `GUIDE.md` and other relevant documentation for your feature.

### Creating New Rule Files

All new rule files must be placed in the `.ai/rules/` directory within a project after running `vdk init`. If you are contributing new default rule templates, they should be added to the `templates/` directory in this repository.

Thank you for contributing to VDK CLI!
