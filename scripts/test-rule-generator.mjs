import { RuleGenerator } from './src/scanner/core/RuleGenerator.js';

async function test() {
  console.log('Testing RuleGenerator...');

  try {
    const generator = new RuleGenerator({ verbose: true });

    // Mock analysis data
    const analysisData = {
      techStack: {
        frameworks: ['Next.js', 'React'],
        primaryLanguages: ['TypeScript'],
        hasDocker: true,
      },
      projectStructure: { root: process.cwd() },
    };

    console.log('1. Testing initialization...');
    if (!(generator.mapper && generator.configExtractor))
      throw new Error('Components not initialized');

    console.log('2. Testing selectRelevantTasks...');
    const tasks = generator.selectRelevantTasks(analysisData);
    console.log('   Tasks:', tasks);

    if (!(tasks.includes('UI-Component') && tasks.includes('API-Endpoints'))) {
      throw new Error('Task selection logic failure');
    }

    console.log('3. Testing selectRelevantTools...');
    const tools = generator.selectRelevantTools(analysisData);
    console.log('   Tools:', tools);

    console.log('SUCCESS: RuleGenerator refactor verified.');
  } catch (error) {
    console.error('FAILURE:', error);
    process.exit(1);
  }
}

test();
