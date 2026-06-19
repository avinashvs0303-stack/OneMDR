import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method: string }>();
    // Never throttle CORS preflight — throttled preflights return 429 with no
    // CORS headers, which the browser misreports as a CORS policy failure.
    if (req.method === 'OPTIONS') return true;
    return super.shouldSkip(context);
  }
}
