/**
 * ProjectContextAnalyzer
 * ----------------------
 * Shared module for analyzing project context.
 * Consolidates framework, language, technology, and architecture detection.
 *
 * Usage:
 *   import { ProjectContextAnalyzer } from '../shared/ProjectContextAnalyzer.js';
 *   const analyzer = new ProjectContextAnalyzer(projectPath);
 *   const context = await analyzer.analyze();
 */

import fs from 'node:fs';
import path from 'node:path';

export class ProjectContextAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Analyze project and return comprehensive context
   * @param {Object} projectData - Optional pre-scanned project data
   * @returns {Object} Project context
   */
  async analyze(projectData = null) {
    const context = {
      name: path.basename(this.projectPath),
      framework: this.detectFramework(projectData),
      language: this.detectPrimaryLanguage(projectData),
      technologies: this.detectTechnologies(projectData),
      architecture: this.detectArchitecture(projectData),
      patterns: this.detectPatterns(projectData),
      structure: this.analyzeStructure(projectData),
      packageManager: this.detectPackageManager(projectData),
      platforms: this.detectTargetPlatforms(projectData),
    };

    context.summary = this.generateSummary(context);
    return context;
  }

  /**
   * Detect framework from package.json and file structure
   */
  detectFramework(_projectData) {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.next) return 'nextjs';
      if (deps.nuxt) return 'nuxt';
      if (deps['@angular/core']) return 'angular';
      if (deps.svelte) return 'svelte';
      if (deps.vue) return 'vue';
      if (deps.react) return 'react';
      if (deps.express) return 'express';
      if (deps.fastify) return 'fastify';
      if (deps.hono) return 'hono';
      if (deps.nestjs || deps['@nestjs/core']) return 'nestjs';
    } catch {
      // Check for non-Node projects
      if (fs.existsSync(path.join(this.projectPath, 'requirements.txt'))) return 'python';
      if (fs.existsSync(path.join(this.projectPath, 'pyproject.toml'))) return 'python';
      if (fs.existsSync(path.join(this.projectPath, 'Cargo.toml'))) return 'rust';
      if (fs.existsSync(path.join(this.projectPath, 'go.mod'))) return 'go';
    }

    return 'generic';
  }

  /**
   * Detect primary programming language
   */
  detectPrimaryLanguage(projectData) {
    // Check tsconfig first
    if (fs.existsSync(path.join(this.projectPath, 'tsconfig.json'))) {
      return 'typescript';
    }

    // Check package.json for TypeScript
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.typescript) return 'typescript';
    } catch {
      // Continue with file-based detection
    }

    // Check for language-specific files
    if (fs.existsSync(path.join(this.projectPath, 'requirements.txt'))) return 'python';
    if (fs.existsSync(path.join(this.projectPath, 'Cargo.toml'))) return 'rust';
    if (fs.existsSync(path.join(this.projectPath, 'go.mod'))) return 'go';

    // Use projectData if available
    if (projectData?.files) {
      const extensions = projectData.files.map(f => path.extname(f.name || f));
      const counts = extensions.reduce((acc, ext) => {
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
      }, {});

      const langMap = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.go': 'go',
        '.rs': 'rust',
      };

      const mostCommon = Object.keys(counts).reduce(
        (a, b) => (counts[a] > counts[b] ? a : b),
        '.js'
      );
      return langMap[mostCommon] || 'javascript';
    }

    return 'javascript';
  }

  /**
   * Detect technologies and libraries in use
   */
  detectTechnologies(_projectData) {
    const technologies = [];

    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Styling
      if (deps.tailwindcss) technologies.push('tailwind');
      if (deps['styled-components']) technologies.push('styled-components');
      if (deps.sass) technologies.push('sass');

      // State management
      if (deps.redux || deps['@reduxjs/toolkit']) technologies.push('redux');
      if (deps.zustand) technologies.push('zustand');
      if (deps.jotai) technologies.push('jotai');

      // API/Data
      if (deps['@tanstack/react-query'] || deps['react-query']) technologies.push('react-query');
      if (deps['@trpc/client'] || deps['@trpc/server']) technologies.push('trpc');
      if (deps.axios) technologies.push('axios');
      if (deps.prisma || deps['@prisma/client']) technologies.push('prisma');
      if (deps.drizzle || deps['drizzle-orm']) technologies.push('drizzle');

      // Testing
      if (deps.jest) technologies.push('jest');
      if (deps.vitest) technologies.push('vitest');
      if (deps['@playwright/test']) technologies.push('playwright');
      if (deps.cypress) technologies.push('cypress');

      // Auth
      if (deps['@clerk/nextjs'] || deps['@clerk/clerk-react']) technologies.push('clerk');
      if (deps['next-auth']) technologies.push('next-auth');

      // UI Libraries
      if (
        deps['@radix-ui/react-dialog'] ||
        Object.keys(deps).some(k => k.startsWith('@radix-ui'))
      ) {
        technologies.push('radix');
      }
      if (deps['@shadcn/ui'] || fs.existsSync(path.join(this.projectPath, 'components/ui'))) {
        technologies.push('shadcn');
      }
    } catch {
      // Non-Node project or error reading package.json
    }

    // File-based detection
    const indicators = {
      'docker-compose.yml': 'docker',
      Dockerfile: 'docker',
      '.github/workflows': 'github-actions',
      'vercel.json': 'vercel',
      'netlify.toml': 'netlify',
      '.eslintrc': 'eslint',
      'biome.json': 'biome',
      '.prettierrc': 'prettier',
    };

    for (const [file, tech] of Object.entries(indicators)) {
      if (fs.existsSync(path.join(this.projectPath, file))) {
        technologies.push(tech);
      }
    }

    return [...new Set(technologies)]; // Dedupe
  }

  /**
   * Detect project architecture pattern
   */
  detectArchitecture(_projectData) {
    const hasAppDir = fs.existsSync(path.join(this.projectPath, 'app'));
    const hasSrcDir = fs.existsSync(path.join(this.projectPath, 'src'));
    const hasPagesDir = fs.existsSync(path.join(this.projectPath, 'pages'));

    // Next.js App Router
    if (hasAppDir && fs.existsSync(path.join(this.projectPath, 'app/layout.tsx'))) {
      return 'app-router';
    }

    // Next.js Pages Router
    if (hasPagesDir) {
      return 'pages-router';
    }

    // Monorepo
    if (
      fs.existsSync(path.join(this.projectPath, 'packages')) ||
      fs.existsSync(path.join(this.projectPath, 'apps'))
    ) {
      return 'monorepo';
    }

    // Standard SPA
    if (hasSrcDir) {
      return 'spa';
    }

    return 'standard';
  }

  /**
   * Detect development patterns in use
   */
  detectPatterns(_projectData) {
    const patterns = [];

    // Check for common patterns
    if (fs.existsSync(path.join(this.projectPath, 'src/hooks'))) {
      patterns.push('custom-hooks');
    }
    if (fs.existsSync(path.join(this.projectPath, 'src/components'))) {
      patterns.push('component-based');
    }
    if (fs.existsSync(path.join(this.projectPath, 'src/services'))) {
      patterns.push('service-layer');
    }
    if (fs.existsSync(path.join(this.projectPath, 'src/utils'))) {
      patterns.push('utility-modules');
    }
    if (fs.existsSync(path.join(this.projectPath, 'src/store'))) {
      patterns.push('state-management');
    }
    if (
      fs.existsSync(path.join(this.projectPath, 'src/api')) ||
      fs.existsSync(path.join(this.projectPath, 'app/api'))
    ) {
      patterns.push('api-routes');
    }

    return patterns;
  }

  /**
   * Analyze project structure
   */
  analyzeStructure(_projectData) {
    const structure = {
      type: 'unknown',
      hasTests: false,
      hasTypes: false,
      hasDocs: false,
    };

    if (fs.existsSync(path.join(this.projectPath, 'src'))) {
      structure.type = 'src-layout';
    } else if (fs.existsSync(path.join(this.projectPath, 'app'))) {
      structure.type = 'app-dir';
    } else if (fs.existsSync(path.join(this.projectPath, 'lib'))) {
      structure.type = 'lib-layout';
    }

    structure.hasTests =
      fs.existsSync(path.join(this.projectPath, 'tests')) ||
      fs.existsSync(path.join(this.projectPath, '__tests__')) ||
      fs.existsSync(path.join(this.projectPath, 'test'));

    structure.hasTypes =
      fs.existsSync(path.join(this.projectPath, 'types')) ||
      fs.existsSync(path.join(this.projectPath, '@types'));

    structure.hasDocs =
      fs.existsSync(path.join(this.projectPath, 'docs')) ||
      fs.existsSync(path.join(this.projectPath, 'documentation'));

    return structure;
  }

  /**
   * Detect package manager
   */
  detectPackageManager(_projectData) {
    if (fs.existsSync(path.join(this.projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(this.projectPath, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(this.projectPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(this.projectPath, 'package-lock.json'))) return 'npm';

    return 'npm'; // Default
  }

  /**
   * Detect target AI assistant platforms
   */
  detectTargetPlatforms(_projectData) {
    const platforms = [];

    // Check for existing configuration files
    const platformIndicators = {
      'claude-code': ['.claude', 'CLAUDE.md'],
      cursor: ['.cursor', '.cursor/rules'],
      windsurf: ['.windsurf', '.windsurf/rules'],
      'github-copilot': ['.github/copilot-instructions.md'],
      'gemini-cli': ['GEMINI.md', '.gemini'],
      aider: ['.aider.conf.yml', '.aiderignore'],
    };

    for (const [platform, indicators] of Object.entries(platformIndicators)) {
      for (const indicator of indicators) {
        if (fs.existsSync(path.join(this.projectPath, indicator))) {
          platforms.push(platform);
          break;
        }
      }
    }

    return platforms;
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(context) {
    const parts = [];

    if (context.framework !== 'generic') {
      parts.push(context.framework);
    }

    parts.push(context.language);

    if (context.architecture !== 'standard') {
      parts.push(context.architecture);
    }

    if (context.technologies.length > 0) {
      parts.push(`with ${context.technologies.slice(0, 3).join(', ')}`);
    }

    return `${parts.join(' ')} project`;
  }
}

/**
 * Convenience function for one-off analysis
 */
export async function analyzeProjectContext(projectPath, projectData = null) {
  const analyzer = new ProjectContextAnalyzer(projectPath);
  return analyzer.analyze(projectData);
}
