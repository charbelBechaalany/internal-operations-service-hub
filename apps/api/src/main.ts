import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * whitelist strips properties the DTO does not declare, and
   * forbidNonWhitelisted rejects them outright. Together they mean a client
   * cannot smuggle a field the API never agreed to accept, such as a status.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new DomainExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();