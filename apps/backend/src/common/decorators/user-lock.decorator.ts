import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { UserLockInterceptor } from '../../core/interceptors/user-lock.interceptor';

/**
 * Decorator to apply distributed Redis user-level mutex locking.
 * Directly adapted from valkyrie-nodejs (@PlayerLock).
 */
export function UserLock() {
  return applyDecorators(UseInterceptors(UserLockInterceptor));
}
