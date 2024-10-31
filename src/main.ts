import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as morgan from 'morgan';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'log', 'warn', 'debug'],
  });
  app.use(morgan('common'));
  const configService = app.get(ConfigService);
  const port = configService.get<string>('PORT');
  app.enableCors();
  await app.listen(port ? port : 3000);
  console.log(`listening on ${port}`);
}
bootstrap();
