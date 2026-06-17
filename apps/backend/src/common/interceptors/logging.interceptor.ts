import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

/**
 * Attaches a unique X-Request-Id to every request/response.
 * nestjs-pino handles actual request logging; this just ensures
 * the requestId is threaded through for correlation.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).requestId = requestId;
    request.headers['x-request-id'] = requestId;

    return next.handle().pipe(
      tap(() => {
        const reply = context.switchToHttp().getResponse();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        reply.header('x-request-id', requestId);
      }),
    );
  }
}
