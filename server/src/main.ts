import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import 'dotenv/config';
import { validateEnv } from './config/env.validator';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  // Validate environment variables before starting
  try {
    validateEnv();
  } catch (err) {
    logger.error('Environment validation failed:', err);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Nest server listening on ${port}`);
}

bootstrap();
