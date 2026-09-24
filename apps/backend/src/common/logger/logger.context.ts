import { AsyncLocalStorage } from 'async_hooks';

export interface LoggerContext {
  userId?: string;
  email?: string;
  requestId?: string;
}

export const loggerContext = new AsyncLocalStorage<LoggerContext>();
