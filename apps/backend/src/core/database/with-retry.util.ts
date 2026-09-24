import { Logger } from '@nestjs/common';

const defaultLogger = new Logger('TransactionRetry');

interface LoggerLike {
  warn(message: string, context?: string): void;
}

/**
 * Executes a transactional database operation with exponential backoff and jitter.
 * Automatically retries on MySQL transient lock contention errors (ER_LOCK_DEADLOCK, ER_LOCK_WAIT_TIMEOUT).
 */
export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 50,
  customLogger?: LoggerLike,
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      const dbErr = err as { code?: string; errno?: number };
      const code = dbErr?.code || dbErr?.errno;
      const isTransient =
        code === 'ER_LOCK_DEADLOCK' ||
        code === 1213 ||
        code === 'ER_LOCK_WAIT_TIMEOUT' ||
        code === 1205 ||
        code === 'PROTOCOL_CONNECTION_LOST';

      if (!isTransient || attempt >= maxRetries) {
        throw err;
      }

      const backoff = baseDelayMs * Math.pow(2, attempt) + Math.random() * 25;
      const logMsg = `Transient MySQL lock conflict [${String(code)}]. Retrying in ${Math.round(backoff)}ms (Attempt ${attempt}/${maxRetries})...`;

      if (customLogger && typeof customLogger.warn === 'function') {
        customLogger.warn(logMsg, 'TransactionRetry');
      } else {
        defaultLogger.warn(logMsg);
      }

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new Error('Transaction failed after maximum retries');
}
