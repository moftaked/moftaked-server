import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as morgan from 'morgan';
import * as fs from 'fs';

async function bootstrap() {
    const httpsOptions = {
    	key: fs.readFileSync('/home/tony/certs/privkey.pem'),
	cert: fs.readFileSync('/home/tony/certs/fullchain.pem')
    }
    const app = await NestFactory.create(AppModule, {
    logger: ['error', 'log', 'warn', 'debug'],
    httpsOptions,
  });
  const accessLogStream = fs.createWriteStream('access.log', { flags: 'a' });
  app.use(morgan('combined', { stream: accessLogStream }));
  const configService = app.get(ConfigService);
  const port = configService.get<string>('PORT');
  app.enableCors();
  await app.listen(port ? port : 3000);
  console.log(`listening on ${port}`);
}
bootstrap();
