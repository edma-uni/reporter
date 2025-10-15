import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // Get correlation ID from header or generate a new one
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();

    // Attach to request object
    req.correlationId = correlationId;

    // Add to response headers
    res.setHeader('x-correlation-id', correlationId);

    // Log incoming request with correlation ID
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;

    this.logger.log(
      `[${correlationId}] ${method} ${originalUrl} - Started from ${ip}`,
    );

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      this.logger.log(
        `[${correlationId}] ${method} ${originalUrl} - ${statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
