/**
 * Package Analyzer
 * Analyzes package.json files to detect technologies, frameworks, and tools used in the project
 */

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Maps of package names to technology categories and specific technologies
 */
const TECH_MAPPINGS = {
  // Frontend frameworks
  frontend: {
    react: 'React',
    'react-dom': 'React',
    next: 'Next.js',
    vue: 'Vue.js',
    nuxt: 'Nuxt.js',
    '@angular/core': 'Angular',
    svelte: 'Svelte',
    preact: 'Preact',
    '@remix-run/react': 'Remix',
    gatsby: 'Gatsby',
    astro: 'Astro',
    '@astrojs/starlight': 'Starlight',
  },

  // Backend services and APIs
  backend_services: {
    // Auth & User Management
    '@supabase/supabase-js': 'Supabase',
    '@supabase/auth-helpers-nextjs': 'Supabase',
    '@supabase/auth-helpers-react': 'Supabase',
    '@supabase/auth-ui-react': 'Supabase',
    '@supabase/auth-ui-shared': 'Supabase',
    '@supabase/postgrest-js': 'Supabase',
    '@supabase/storage-js': 'Supabase',
    '@supabase/functions-js': 'Supabase',
    '@supabase/realtime-js': 'Supabase',
    '@clerk/nextjs': 'Clerk',
    '@clerk/clerk-react': 'Clerk',
    'next-auth': 'NextAuth.js',
    '@auth/core': 'Auth.js',
    auth: 'Auth.js',
    firebase: 'Firebase',
    'firebase-admin': 'Firebase',
    auth0: 'Auth0',
    '@auth0/nextjs-auth0': 'Auth0',
    passport: 'Passport.js',
    'keycloak-js': 'Keycloak',
    lucia: 'Lucia Auth',

    // Backend as a Service
    appwrite: 'Appwrite',
    pocketbase: 'PocketBase',
    '@aws-sdk/client-dynamodb': 'AWS DynamoDB',
    '@aws-sdk/client-s3': 'AWS S3',
    'mongodb-stitch': 'MongoDB Realm',
    realm: 'MongoDB Realm',
    nhost: 'Nhost',
    '@nhost/react': 'Nhost',

    // ORM & Database Access
    '@prisma/client': 'Prisma',
    prisma: 'Prisma',
    'drizzle-orm': 'Drizzle ORM',
    typeorm: 'TypeORM',
    sequelize: 'Sequelize',
    mongoose: 'Mongoose',
    kysely: 'Kysely',
    knex: 'Knex.js',
    'mikro-orm': 'MikroORM',
    '@mikro-orm/core': 'MikroORM',
    objection: 'Objection.js',

    // Type-Safe APIs
    '@trpc/client': 'tRPC',
    '@trpc/server': 'tRPC',
    hono: 'Hono',
    '@hono/zod-validator': 'Hono',

    // CMS & Content
    contentful: 'Contentful',
    '@contentful/rich-text-react-renderer': 'Contentful',
    sanity: 'Sanity.io',
    '@sanity/client': 'Sanity.io',
    strapi: 'Strapi',
    cosmicjs: 'Cosmic',
    graphcms: 'GraphCMS',
    hygraph: 'Hygraph',
    payload: 'Payload CMS',
    keystonejs: 'KeystoneJS',

    // Payments & E-commerce
    stripe: 'Stripe',
    '@stripe/stripe-js': 'Stripe',
    '@stripe/react-stripe-js': 'Stripe',
    shopify: 'Shopify',
    '@shopify/shopify-api': 'Shopify',
    commerce: 'Commerce.js',
    '@commercetools/sdk-client': 'Commercetools',
    'medusa-js': 'Medusa',
    '@medusajs/medusa': 'Medusa',
    'paypal-rest-sdk': 'PayPal',

    // Email
    nodemailer: 'Nodemailer',
    sendgrid: 'SendGrid',
    '@sendgrid/mail': 'SendGrid',
    mailchimp: 'Mailchimp',
    postmark: 'Postmark',
    resend: 'Resend',

    // AI & ML
    openai: 'OpenAI',
    langchain: 'LangChain',
    '@langchain/openai': 'LangChain',
    ai: 'Vercel AI',
    tensorflow: 'TensorFlow',
    'tensorflow-js': 'TensorFlow.js',
    transformers: 'Hugging Face Transformers',
    replicate: 'Replicate',
  },

  // Databases
  databases: {
    pg: 'PostgreSQL',
    postgres: 'PostgreSQL',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mysql2: 'MySQL',
    mongodb: 'MongoDB',
    mongoose: 'MongoDB',
    sqlite3: 'SQLite',
    'better-sqlite3': 'SQLite',
    redis: 'Redis',
    ioredis: 'Redis',
    'cassandra-driver': 'Cassandra',
    'neo4j-driver': 'Neo4j',
    couchdb: 'CouchDB',
    fauna: 'FaunaDB',
    firestore: 'Firestore',
    '@firebase/firestore': 'Firestore',
    level: 'LevelDB',
    duckdb: 'DuckDB',
    dynamodb: 'DynamoDB',
    '@aws-sdk/client-dynamodb': 'DynamoDB',
    planetscale: 'PlanetScale',
    '@planetscale/database': 'PlanetScale',
    turso: 'Turso',
    '@libsql/client': 'Turso',
    upstash: 'Upstash',
    '@upstash/redis': 'Upstash Redis',
  },

  // UI libraries
  ui: {
    // Material Design
    '@mui/material': 'Material UI',
    '@mui/core': 'Material UI',
    '@mui/icons-material': 'Material UI',
    '@mui/styles': 'Material UI',
    '@material-ui/core': 'Material UI',
    '@material-ui/icons': 'Material UI',

    // Chakra UI
    '@chakra-ui/react': 'Chakra UI',
    '@chakra-ui/core': 'Chakra UI',
    '@chakra-ui/icons': 'Chakra UI',

    // Ant Design
    antd: 'Ant Design',
    '@ant-design/icons': 'Ant Design',
    '@ant-design/charts': 'Ant Design',
    '@ant-design/pro-components': 'Ant Design Pro',

    // Bootstrap
    bootstrap: 'Bootstrap',
    'react-bootstrap': 'React Bootstrap',
    '@popperjs/core': 'Bootstrap',

    // Tailwind CSS
    tailwindcss: 'Tailwind CSS',
    '@tailwindcss/forms': 'Tailwind CSS',
    '@tailwindcss/typography': 'Tailwind CSS',
    '@tailwindcss/aspect-ratio': 'Tailwind CSS',
    '@tailwindcss/container-queries': 'Tailwind CSS',
    'tailwind-merge': 'Tailwind CSS',
    'tailwindcss-animate': 'Tailwind CSS',
    daisyui: 'DaisyUI',

    // Headless UI
    '@headlessui/react': 'Headless UI',
    '@headlessui/vue': 'Headless UI',

    // Radix UI
    '@radix-ui/react-alert-dialog': 'Radix UI',
    '@radix-ui/react-dialog': 'Radix UI',
    '@radix-ui/react-popover': 'Radix UI',
    '@radix-ui/react-select': 'Radix UI',
    '@radix-ui/primitives': 'Radix UI',
    '@radix-ui/react-accordion': 'Radix UI',
    '@radix-ui/colors': 'Radix UI',
    '@radix-ui/themes': 'Radix UI',
    '@radix-ui': 'Radix UI',

    // shadcn/ui
    'class-variance-authority': 'shadcn/ui',
    clsx: 'shadcn/ui',
    cmdk: 'shadcn/ui',
    'lucide-react': 'shadcn/ui',

    // Styled components
    'styled-components': 'Styled Components',
    emotion: 'Emotion',
    '@emotion/react': 'Emotion',
    '@emotion/styled': 'Emotion',
    '@theme-ui/core': 'Theme UI',
    'theme-ui': 'Theme UI',

    // Additional UI libraries
    '@mantine/core': 'Mantine',
    '@mantine/hooks': 'Mantine',
    '@mantine/form': 'Mantine',
    primereact: 'PrimeReact',
    'semantic-ui-react': 'Semantic UI',
    'framer-motion': 'Framer Motion',
    '@nextui-org/react': 'NextUI',
    'vanilla-extract': 'Vanilla Extract',

    // CSS
    sass: 'Sass',
    less: 'Less',
    postcss: 'PostCSS',
    autoprefixer: 'PostCSS',
    cssnano: 'PostCSS',
  },

  // State management
  stateManagement: {
    // Redux family
    redux: 'Redux',
    'react-redux': 'Redux',
    '@reduxjs/toolkit': 'Redux Toolkit',
    'redux-thunk': 'Redux',
    'redux-saga': 'Redux Saga',
    'redux-observable': 'Redux Observable',
    'redux-persist': 'Redux Persist',

    // Atomic state
    recoil: 'Recoil',
    jotai: 'Jotai',
    valtio: 'Valtio',
    nanostores: 'Nano Stores',
    pullstate: 'Pullstate',

    // Flux-inspired
    mobx: 'MobX',
    'mobx-react': 'MobX',
    'mobx-state-tree': 'MobX State Tree',

    // Custom hooks-based
    zustand: 'Zustand',
    constate: 'Constate',
    hookstate: 'Hookstate',

    // State machines
    xstate: 'XState',
    '@xstate/react': 'XState',
    robot: 'Robot',
    stately: 'Stately',

    // Proxies
    immer: 'Immer',
    'use-immer': 'Immer',

    // Server state
    '@tanstack/react-query': 'React Query',
    'react-query': 'React Query',
    swr: 'SWR',
    '@tanstack/query': 'TanStack Query',
    '@apollo/client': 'Apollo Client',
    urql: 'URQL',
    'relay-runtime': 'Relay',
  },

  // Data fetching
  dataFetching: {
    axios: 'Axios',
    fetch: 'Fetch API',
    'node-fetch': 'Node Fetch',
    'graphql-request': 'GraphQL Request',
    got: 'Got',
    superagent: 'SuperAgent',
    undici: 'Undici',
    ofetch: 'oFetch',
  },

  // Backend frameworks
  backend: {
    // Node.js frameworks
    express: 'Express.js',
    koa: 'Koa.js',
    fastify: 'Fastify',
    nest: 'NestJS',
    '@nestjs/core': 'NestJS',
    '@nestjs/common': 'NestJS',
    hapi: 'Hapi',
    '@hapi/hapi': 'Hapi',
    restify: 'Restify',
    polka: 'Polka',
    meteor: 'Meteor',
    feathers: 'Feathers',
    '@feathersjs/feathers': 'Feathers',
    sails: 'Sails.js',
    adonis: 'AdonisJS',
    '@adonisjs/core': 'AdonisJS',
    loopback: 'LoopBack',
    '@loopback/core': 'LoopBack',

    // Python frameworks
    django: 'Django',
    flask: 'Flask',
    fastapi: 'FastAPI',
    pyramid: 'Pyramid',
    tornado: 'Tornado',
    starlette: 'Starlette',
    falcon: 'Falcon',
    bottle: 'Bottle',

    // Java/Kotlin frameworks
    spring: 'Spring',
    'spring-boot': 'Spring Boot',
    micronaut: 'Micronaut',
    quarkus: 'Quarkus',
    dropwizard: 'Dropwizard',
    ktor: 'Ktor',

    // Go frameworks
    gin: 'Gin',
    echo: 'Echo',
    fiber: 'Fiber',
    'gorilla/mux': 'Gorilla',
    chi: 'Chi',

    // Ruby/PHP frameworks
    rails: 'Ruby on Rails',
    sinatra: 'Sinatra',
    laravel: 'Laravel',
    symfony: 'Symfony',
    slim: 'Slim',
    cakephp: 'CakePHP',
    yii: 'Yii',
    codeigniter: 'CodeIgniter',

    // .NET frameworks
    aspnetcore: 'ASP.NET Core',
    'microsoft.aspnetcore': 'ASP.NET Core',
    entityframeworkcore: 'Entity Framework Core',
  },

  // Serverless frameworks
  serverless: {
    serverless: 'Serverless Framework',
    'serverless-http': 'Serverless HTTP',
    'aws-lambda': 'AWS Lambda',
    '@aws-sdk/client-lambda': 'AWS Lambda',
    'aws-amplify': 'AWS Amplify',
    '@aws-amplify/core': 'AWS Amplify',
    'firebase-functions': 'Firebase Functions',
    '@google-cloud/functions-framework': 'Google Cloud Functions',
    'azure-functions': 'Azure Functions',
    vercel: 'Vercel',
    'netlify-lambda': 'Netlify Functions',
    '@netlify/functions': 'Netlify Functions',
    sst: 'SST (Serverless Stack)',
    '@sst/core': 'SST (Serverless Stack)',
  },

  // Testing frameworks
  testing: {
    // Unit testing
    jest: 'Jest',
    '@jest/core': 'Jest',
    vitest: 'Vitest',
    mocha: 'Mocha',
    jasmine: 'Jasmine',
    karma: 'Karma',
    ava: 'AVA',
    tape: 'Tape',
    chai: 'Chai',
    sinon: 'Sinon',
    assert: 'Node.js Assert',

    // Component testing
    '@testing-library/react': 'React Testing Library',
    '@testing-library/react-hooks': 'React Testing Library',
    '@testing-library/vue': 'Vue Testing Library',
    '@testing-library/svelte': 'Svelte Testing Library',
    '@testing-library/angular': 'Angular Testing Library',
    '@testing-library/user-event': 'Testing Library',
    '@testing-library/dom': 'Testing Library',
    '@testing-library/jest-dom': 'Testing Library',
    enzyme: 'Enzyme',
    '@vue/test-utils': 'Vue Test Utils',
    'react-test-renderer': 'React Test Renderer',

    // E2E testing
    cypress: 'Cypress',
    '@cypress/react': 'Cypress Component Testing',
    playwright: 'Playwright',
    '@playwright/test': 'Playwright',
    puppeteer: 'Puppeteer',
    nightwatch: 'Nightwatch',
    testcafe: 'TestCafe',
    webdriverio: 'WebdriverIO',
    'selenium-webdriver': 'Selenium',

    // Visual testing
    storybook: 'Storybook',
    '@storybook/react': 'Storybook',
    '@storybook/vue': 'Storybook',
    '@storybook/svelte': 'Storybook',
    '@storybook/angular': 'Storybook',
    '@storybook/addon-interactions': 'Storybook',
    chromatic: 'Chromatic',
    loki: 'Loki',
  },

  // Build tools
  buildTools: {
    // Bundlers
    webpack: 'Webpack',
    vite: 'Vite',
    '@vitejs/plugin-react': 'Vite',
    '@vitejs/plugin-vue': 'Vite',
    rollup: 'Rollup',
    '@rollup/plugin-babel': 'Rollup',
    parcel: 'Parcel',
    esbuild: 'esbuild',
    swc: 'SWC',
    '@swc/core': 'SWC',
    turbopack: 'Turbopack',
    bun: 'Bun',
    rspack: 'Rspack',

    // Build frameworks
    nx: 'Nx',
    turborepo: 'Turborepo',
    turbo: 'Turborepo',
    lerna: 'Lerna',
    rush: 'Rush',
    gulp: 'Gulp',
    grunt: 'Grunt',
    bazel: 'Bazel',

    // Code transformers
    babel: 'Babel',
    '@babel/core': 'Babel',
    '@babel/preset-env': 'Babel',
    '@babel/preset-react': 'Babel',
    typescript: 'TypeScript',
    'ts-node': 'ts-node',
    tsc: 'TypeScript',
    postcss: 'PostCSS',
  },

  // Mobile frameworks
  mobile: {
    // React Native
    'react-native': 'React Native',
    '@react-native/metro-config': 'React Native',
    expo: 'Expo',
    'expo-cli': 'Expo',
    '@expo/vector-icons': 'Expo',
    'react-native-web': 'React Native Web',

    // Flutter/Dart
    flutter: 'Flutter',
    dart: 'Dart',
    flutter_bloc: 'Flutter',

    // Native platforms
    swift: 'Swift',
    kotlin: 'Kotlin',
    android: 'Android',
    androidx: 'Android',
    uikit: 'iOS',
    swiftui: 'SwiftUI',

    // Hybrid
    capacitor: 'Capacitor',
    '@capacitor/core': 'Capacitor',
    cordova: 'Cordova',
    ionic: 'Ionic',
    '@ionic/react': 'Ionic React',
    '@ionic/vue': 'Ionic Vue',
    tauri: 'Tauri',
    '@tauri-apps/api': 'Tauri',
  },
  styling: {
    postcss: 'PostCSS',
    autoprefixer: 'Autoprefixer',
    cssnano: 'CSSNano',
    tailwindcss: 'Tailwind CSS',
    'styled-components': 'Styled Components',
    'styled-system': 'Styled System',
    '@emotion/react': 'Emotion',
    '@emotion/styled': 'Emotion',
    sass: 'Sass',
    less: 'Less',
  },

  // Database and ORM
  database: {
    mongoose: 'MongoDB (Mongoose)',
    mongodb: 'MongoDB',
    typeorm: 'TypeORM',
    prisma: 'Prisma',
    '@prisma/client': 'Prisma',
    sequelize: 'Sequelize',
    pg: 'PostgreSQL',
    mysql: 'MySQL',
    mysql2: 'MySQL',
    sqlite3: 'SQLite',
    redis: 'Redis',
    ioredis: 'Redis',
    knex: 'Knex.js',
    'drizzle-orm': 'Drizzle ORM',
  },

  // API and fetching
  api: {
    axios: 'Axios',
    graphql: 'GraphQL',
    'apollo-client': 'Apollo Client',
    '@apollo/client': 'Apollo Client',
    'apollo-server': 'Apollo Server',
    '@apollo/server': 'Apollo Server',
    'express-graphql': 'Express GraphQL',
    swagger: 'Swagger',
    openapi: 'OpenAPI',
    trpc: 'tRPC',
    '@trpc/server': 'tRPC',
    '@trpc/client': 'tRPC',
    'react-router-dom': 'React Router',
    'vue-router': 'Vue Router',
    '@angular/router': 'Angular Router',
    'next-auth': 'NextAuth.js',
    '@auth/nextjs': 'Auth.js',
    '@supabase/supabase-js': 'Supabase',
    firebase: 'Firebase',
    '@firebase/app': 'Firebase',
  },

  // Form handling
  forms: {
    'react-hook-form': 'React Hook Form',
    formik: 'Formik',
    yup: 'Yup',
    zod: 'Zod',
    joi: 'Joi',
    ajv: 'AJV',
    '@hookform/resolvers': 'React Hook Form',
  },
}

/**
 * Analyzes package.json files to identify technology stack
 */
export class PackageAnalyzer {
  /**
   * Analyze package.json to detect technologies used in the project
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object>} - Object containing detected technologies
   */
  static async analyzeDependencies(projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json')

      // Check if package.json exists
      try {
        await fs.access(packageJsonPath)
      } catch {
        // package.json doesn't exist
        return { detected: false }
      }

      // Read and parse the package.json file
      const content = await fs.readFile(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content)

      // Extract dependencies
      const allDependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      }

      // Detect technologies based on dependencies
      const detectedTech = PackageAnalyzer.detectTechnologies(allDependencies)

      // Extract project metadata
      const projectInfo = {
        name: packageJson.name || '',
        version: packageJson.version || '',
        description: packageJson.description || '',
        author: packageJson.author || '',
        license: packageJson.license || '',
        keywords: packageJson.keywords || [],
        engines: packageJson.engines || {},
        hasScripts: Object.keys(packageJson.scripts || {}).length > 0,
        scripts: packageJson.scripts || {},
      }

      return {
        detected: true,
        technologies: detectedTech,
        projectInfo,
        dependencyCount: Object.keys(allDependencies).length,
      }
    } catch (error) {
      console.warn(`Warning: Error analyzing package.json: ${error.message}`)
      return { detected: false }
    }
  }

  /**
   * Detect technologies based on dependencies
   *
   * @param {Object} dependencies - Dependencies from package.json
   * @returns {Object} - Object containing detected technologies by category
   */
  static detectTechnologies(dependencies) {
    const result = {}
    const depNames = Object.keys(dependencies)

    // For each technology category
    for (const [category, techMap] of Object.entries(TECH_MAPPINGS)) {
      const detectedInCategory = []

      // Check each dependency against the technology map for this category
      for (const dep of depNames) {
        // Handle scope packages like @angular/core
        const _basePackageName = dep.split('/')[0]

        // First try exact match
        if (techMap[dep]) {
          detectedInCategory.push(techMap[dep])
        }
        // Then try matching by prefix (for scoped packages)
        else {
          const scopedMatches = Object.keys(techMap).filter((key) => {
            // Only match if the dependency starts with the key (for scoped packages like @angular/core)
            // Avoid reverse matching that would make 'react' match 'react-native'
            return dep.startsWith(`${key}/`) || (key.startsWith('@') && dep === key)
          })

          for (const match of scopedMatches) {
            detectedInCategory.push(techMap[match])
          }
        }
      }

      // Add unique detected technologies to the result
      if (detectedInCategory.length > 0) {
        result[category] = [...new Set(detectedInCategory)]
      }
    }

    return result
  }

  /**
   * Determine the primary framework based on detected technologies
   *
   * @param {Object} technologies - Detected technologies object
   * @returns {string|null} - Primary framework name or null if not detected
   */
  static determinePrimaryFramework(technologies) {
    if (!technologies.frontend) {
      return null
    }

    // Framework priority order (more specific frameworks first)
    const frameworkPriority = ['Next.js', 'Nuxt.js', 'Remix', 'Gatsby', 'Angular', 'React', 'Vue.js', 'Svelte']

    // Find the first framework that exists in detected technologies
    for (const framework of frameworkPriority) {
      if (technologies.frontend.includes(framework)) {
        return framework
      }
    }

    return technologies.frontend[0] || null
  }
}
