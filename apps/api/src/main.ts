import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS para dev: la web corre en localhost:3000 y subdominios *.localhost:3000
  // (multi-tenancy). En prod cambiamos esto por el host real (rutinex.app y
  // *.rutinex.app) cuando llegue el deploy en Step 27.
  app.enableCors({
    origin: [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/,
    ],
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
