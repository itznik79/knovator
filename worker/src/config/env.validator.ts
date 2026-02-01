// Environment configuration validator for Worker
// This file validates that all required environment variables are set before the worker starts

const requiredEnvVars = [
  'MONGO_URI',
  'REDIS_URL',
];

const optionalEnvVars = {
  'BULL_QUEUE_NAME': 'job_import_queue',
  'WORKER_FLUSH_MS': '3000',
  'WORKER_BATCH_SIZE': '100',
  'WORKER_MAX_BUFFER_SIZE': '10000',
  'WORKER_CONCURRENCY': '10',
  'WORKER_RATE_LIMIT_MAX': '100',
  'WORKER_RATE_LIMIT_DURATION_MS': '1000',
  'WORKER_METRICS_PORT': '9101',
};

export function validateWorkerEnv() {
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

  // Validate numeric values
  const numericVars = [
    'WORKER_FLUSH_MS',
    'WORKER_BATCH_SIZE',
    'WORKER_MAX_BUFFER_SIZE',
    'WORKER_CONCURRENCY',
    'WORKER_RATE_LIMIT_MAX',
    'WORKER_RATE_LIMIT_DURATION_MS',
    'WORKER_METRICS_PORT',
  ];

  for (const envVar of numericVars) {
    const value = process.env[envVar];
    if (value && isNaN(Number(value))) {
      throw new Error(`${envVar} must be a valid number, got: ${value}`);
    }
  }

  console.log('✅ Worker environment validation passed');
}
