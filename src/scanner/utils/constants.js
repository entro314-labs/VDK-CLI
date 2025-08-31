/**
 * constants.js
 *
 * Central location for all constants used throughout the project-scanner tool.
 */

// Template file names
export const TEMPLATES = {
  CORE_AGENT: 'core-agent.hbs',
  PROJECT_CONTEXT: 'project-context.hbs',
  PROJECT_CONTEXT_ENHANCED: 'project-context-enhanced.hbs',
  COMMON_ERRORS: 'common-errors.hbs',
  MCP_CONFIGURATION: 'mcp-configuration.hbs',
}

// Output rule file names
export const RULES = {
  CORE_AGENT: '00-core-agent.mdc',
  PROJECT_CONTEXT: '01-project-context.mdc',
  COMMON_ERRORS: '02-common-errors.mdc',
  MCP_CONFIGURATION: '03-mcp-configuration.mdc',
}

// Output directories
export const DIRECTORIES = {
  LANGUAGES: 'languages',
  TECHNOLOGIES: 'technologies',
  PATTERNS: 'patterns',
}

// Language rule mapping
export const LANGUAGE_RULE_MAP = {
  javascript: 'JavaScript-Modern.mdc',
  typescript: 'TypeScript-Modern.mdc',
  python: 'Python3.mdc',
  swift: 'Swift.mdc',
  kotlin: 'Kotlin.mdc',
  java: 'Java-Modern.mdc',
  ruby: 'Ruby-Modern.mdc',
  go: 'Go-Modern.mdc',
  rust: 'Rust-Modern.mdc',
  csharp: 'CSharp-Modern.mdc',
  dart: 'Dart-Modern.mdc',
  cpp: 'CPP20.mdc',
}

// Framework rule mapping
export const FRAMEWORK_RULE_MAP = {
  // Frontend Frameworks
  React: 'React-Modern.mdc',
  'Next.js': 'NextJS.mdc',
  'Next.js 13+': 'NextJS13.mdc',
  'Next.js 14+': 'NextJS14.mdc',
  'Next.js 15+': 'NextJS15.mdc',
  'Next.js App Router': 'NextJS-AppRouter.mdc',
  'Vue.js': 'Vue.mdc',
  Angular: 'Angular.mdc',
  Svelte: 'Svelte.mdc',
  Astro: 'Astro.mdc',

  // Backend Frameworks
  Express: 'Express.mdc',
  NestJS: 'NestJS.mdc',
  Django: 'Django.mdc',
  Flask: 'Flask.mdc',
  FastAPI: 'FastAPI.mdc',
  'Spring Boot': 'SpringBoot.mdc',

  // UI Frameworks and libraries
  'Tailwind CSS': 'Tailwind.mdc',
  'Tailwind CSS 3': 'Tailwind3.mdc',
  'shadcn/ui': 'ShadcnUI.mdc',
  'Material UI': 'MaterialUI.mdc',
  Bootstrap: 'Bootstrap.mdc',
  'Chakra UI': 'ChakraUI.mdc',
  'Ant Design': 'AntDesign.mdc',

  // Backend services
  Supabase: 'Supabase.mdc',
  Firebase: 'Firebase.mdc',
  Prisma: 'Prisma.mdc',
  tRPC: 'tRPC.mdc',
  'Drizzle ORM': 'DrizzleORM.mdc',

  // Mobile and native
  SwiftUI: 'SwiftUI.mdc',
  Flutter: 'Flutter.mdc',
  Android: 'Android.mdc',

  // Stacks
  'Supabase-Next.js Stack': 'Supabase-NextJS-Stack.mdc',
}

// Integration rules mapping
export const INTEGRATION_RULES = {
  'shadcn/ui': {
    'Tailwind CSS': 'ShadcnUI-Integration.mdc',
  },
  'Tailwind CSS': {
    'Next.js': 'Tailwind-NextJS-Integration.mdc',
  },
  Supabase: {
    'Next.js': 'Supabase-NextJS-Integration.mdc',
  },
}

// Architecture pattern rule mapping
export const PATTERN_RULE_MAP = {
  MVC: 'MVC.mdc',
  MVVM: 'MVVM.mdc',
  Microservices: 'Microservices.mdc',
}

// Default values
export const DEFAULTS = {
  OUTPUT_PATH: './.vdk/rules',
  PROJECT_NAME: 'Your Project',
}
