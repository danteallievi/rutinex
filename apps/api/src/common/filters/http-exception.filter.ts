import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filtro global. Toma cualquier `HttpException` (incluidos los tirados por
 * `ValidationPipe`) y devuelve el shape de error estándar:
 *
 * { statusCode, message, error, code?, timestamp, path }
 *
 * Fuente de verdad: docs/05-api-conventions.md (sección Errores).
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const httpCtx = host.switchToHttp();
    const response = httpCtx.getResponse<Response>();
    const request = httpCtx.getRequest<Request>();
    const status = exception.getStatus();
    const raw = exception.getResponse();

    const base: Record<string, unknown> =
      typeof raw === 'string'
        ? { statusCode: status, message: raw, error: exception.name }
        : { statusCode: status, ...(raw as Record<string, unknown>) };

    response.status(status).json({
      ...base,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
