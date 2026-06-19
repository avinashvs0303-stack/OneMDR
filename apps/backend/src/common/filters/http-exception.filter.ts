import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    requestId: string;
    timestamp: string;
    path?: string;
  };
}

/**
 * Global exception filter — normalizes ALL errors to a consistent envelope.
 * OWASP A09: never leak stack traces or internal details to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>;
        const rawMessage = body['message'];
        message = Array.isArray(rawMessage)
          ? (rawMessage as string[]).join('; ')
          : typeof rawMessage === 'string'
            ? rawMessage
            : exception.message;
        code =
          typeof body['error'] === 'string'
            ? (body['error'] as string)
            : this.toErrorCode(statusCode);
      } else if (typeof responseBody === 'string') {
        message = responseBody;
        code = this.toErrorCode(statusCode);
      }
    } else if (exception instanceof Error) {
      // Log full error server-side; return generic message to client
      this.logger.error({ err: exception, requestId, path: request.url }, 'Unhandled exception');
    }

    // Never expose internal error details to clients in production (OWASP A09)
    if (
      statusCode === HttpStatus.INTERNAL_SERVER_ERROR &&
      process.env['NODE_ENV'] === 'production'
    ) {
      message = 'An unexpected error occurred';
    }

    const body: ErrorResponse = {
      error: {
        code: code.toUpperCase().replace(/\s+/g, '_'),
        message,
        statusCode,
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    this.logger.warn(
      { statusCode, code, requestId, path: request.url, method: request.method },
      `HTTP ${statusCode} ${code}`,
    );

    void reply.status(statusCode).send(body);
  }

  private toErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] ?? 'ERROR';
  }
}
