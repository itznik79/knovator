// Environment configuration validator
// This file validates that all required environment variables are set before the server starts

const requiredEnvVars = [
  'MONGO_URI',
  'REDIS_URL',
];

const optionalEnvVars = {
  'BULL_QUEUE_NAME': 'job_import_queue',
  'CRON_ENABLED': 'true',
  'PORT': '4000',
  'METRICS_PORT': '9090',
};

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these variables in your .env file or environment.');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Check optional variables and set defaults
  for (const [envVar, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[envVar]) {
      process.env[envVar] = defaultValue;
      warnings.push(`${envVar} not set, using default: ${defaultValue}`);
    }
  }

  if (warnings.length > 0) {
    console.log('⚠️  Using default values:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }

  // Validate URLs
  try {
    if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb')) {
      throw new Error('MONGO_URI must start with "mongodb://" or "mongodb+srv://"');
    }
    if (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith('redis')) {
      throw new Error('REDIS_URL must start with "redis://"');
    }
  } catch (err) {
    console.error('❌ Invalid environment variable format:');
    console.error(`   ${(err as Error).message}`);
    throw err;
  }

  console.log('✅ Environment validation passed');
}
