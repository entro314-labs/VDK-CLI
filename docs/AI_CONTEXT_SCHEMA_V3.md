# AI Context Schema Integration Guide (VDK CLI v3)

## Purpose

This document replaces the previous v2-focused guidance and describes how `VDK-CLI` integrates with the canonical AI Context Schema v3 contract.

The filename is retained for compatibility with existing links, but the runtime contract and examples below are v3.

## Current contract

`VDK-CLI` aligns to the v3 schema model:

- `schemaVersion: "3.0"`
- canonical `kind` taxonomy
- platform component model under `platforms.<platform>.components`
- deterministic frontmatter validation for repository blueprints

## Package naming and resolution

The canonical npm package is:

- `@vdkit/ai-context-schema`

`VDK-CLI` schema validation utilities also support a fallback candidate:

- `ai-context-schema`

This compatibility behavior exists to support mixed local environments during migration.

## Canonical kind taxonomy

Blueprints should use one of these `kind` values:

- `project-memory`
- `conditional-rule`
- `skill`
- `command`
- `workflow`
- `agent`
- `hook`
- `mcp-integration`
- `plugin-distribution`

## Blueprint shape (v3)

Minimal frontmatter expected by the v3 contract:

```yaml
---
schemaVersion: '3.0'
id: 'my-blueprint-id'
title: 'My Blueprint'
description: 'What this blueprint does and when to use it'
version: '1.0.0'
kind: 'skill'
platforms:
  claude-code:
    compatible: true
    enabled: true
    components:
      skills:
        type: claude-skill
        enabled: true
        location: .claude/skills/
        manifests:
          - name: my-blueprint-id
            file: my-blueprint-id.md
---
```

## How VDK-CLI uses the schema

### 1) Validation utility

`src/utils/schema-validator.js` loads schema definitions from the schema package and validates parsed frontmatter.

Primary flows:

- `validateBlueprint(...)`
- `validateCommand(...)`
- `fileValidation.validateMDCFile(...)`
- `fileValidation.validateMDCFiles(...)`

### 2) Rule validation command

`vdk validate` executes `src/validation/validate-rules.js`.

It validates:

- frontmatter parseability
- schema contract conformance
- duplicate IDs

### 3) Contract linting in repository quality pipeline

`VDK-CLI` adds Oxlint JS plugin checks for `.vdk/blueprints/rules` frontmatter through:

- `.oxlintrc.json` (`vdk/validate-blueprints`)
- `pnpm run lint:contracts`
- `pnpm run lint:contracts:dry`
- `pnpm run lint:contracts:fix`

### 4) Formatting + linting stack

`VDK-CLI` uses:

- `oxlint` for JavaScript/TypeScript linting
- `oxfmt` for formatting
- `markdownlint-cli2` for Markdown linting

## CLI commands relevant to schema integration

```bash
# Validate generated/curated rule files
vdk validate

# Repo-level code lint
pnpm run lint

# Blueprint frontmatter contract lint
pnpm run lint:contracts

# Preview deterministic frontmatter normalization
pnpm run lint:contracts:dry

# Apply deterministic frontmatter normalization
pnpm run lint:contracts:fix
```

## Migration notes (v2 -> v3)

If you still have v2-era content, migrate toward:

1. `schemaVersion: "3.0"`
2. canonical `kind` values
3. platform component manifests under `platforms.*.components`
4. stable semver `version` fields
5. kebab-case IDs

## Troubleshooting

### Error: Cannot find module 'ai-context-schema'

Cause:

- Runtime attempted unscoped package resolution while only scoped package is installed.

Resolution:

1. Ensure dependency exists:
   - `@vdkit/ai-context-schema`
2. Ensure validator resolver checks scoped package first.
3. Reinstall dependencies and rerun prepublish checks.

### Error: Failed to load JS plugin `@vdk/oxlint-plugin-blueprints`

Cause:

- Namespace mismatch after package rename.

Resolution:

1. Update `.oxlintrc.json` plugin specifier to:
   - `@vdkit/oxlint-plugin-blueprints`
2. Confirm package is present in `devDependencies`.

## Recommended release checks

Before publishing `VDK-CLI`:

```bash
pnpm run validate
pnpm run lint
pnpm run format:check
pnpm run lint:contracts
```

## Ecosystem alignment

`VDK-CLI` should stay synchronized with the canonical contract source order:

1. `ai-context-schema`
2. `VDK-Blueprints`
3. `VDK-CLI`
4. `VDK-Hub`
5. `VDK-Wiki`

Changes to schema semantics should be propagated in that order to avoid runtime/documentation drift.
