import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de un proxy/load balancer (Vercel/Railway/Cloudflare) `req.ip`
  // viene del header `X-Forwarded-For`. Habilitarlo en prod permite persistir
  // la IP real en `refresh_tokens.ip` (Step 9). En dev (`NODE_ENV !==
  // 'production'`) preferimos `req.ip` directo del socket.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Cookie httpOnly del refresh token (Step 9, ver ADR-017). El parser deja
  // `req.cookies` disponible para los handlers.
  app.use(cookieParser());

  // CORS para dev: la web corre en localhost:3000 y subdominios *.localhost:3000
  // (multi-tenancy). En prod cambiamos esto por el host real (rutinex.app y
  // *.rutinex.app) cuando llegue el deploy en Step 27.
  app.enableCors({
    origin: [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/,
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
