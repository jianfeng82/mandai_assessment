export const BUSINESS_ERRORS = {
  // System (1000s)
  INTERNAL_SERVER_ERROR: {
    code: '1001',
    message: 'Internal server error occurred',
  },
  UNAUTHORIZED: { code: '1002', message: 'Authentication required' },
  FORBIDDEN: { code: '1003', message: 'Insufficient role permissions' },
  INVALID_INPUT: {
    code: '1004',
    message: 'Invalid request payload parameters',
  },
  MAINTENANCE_MODE: { code: '1005', message: 'System under maintenance' },

  // Products & Inventory (2000s)
  PRODUCT_NOT_FOUND: { code: '2001', message: 'Product not found' },
  PRODUCT_INACTIVE: { code: '2002', message: 'Product is currently inactive' },
  OUT_OF_STOCK: { code: '2003', message: 'Product is out of stock' },
  INSUFFICIENT_STOCK: {
    code: '2004',
    message: 'Requested quantity exceeds available inventory',
  },
  INVALID_STOCK_ADJUSTMENT: {
    code: '2005',
    message: 'Stock cannot be reduced below zero',
  },

  // Orders & Concurrency (3000s)
  CONCURRENT_ORDER_IN_PROGRESS: {
    code: '3001',
    message: 'Concurrent order in progress. Please wait a moment.',
  },
  INVALID_ORDER_QUANTITY: {
    code: '3002',
    message: 'Quantity must be at least 1',
  },
  ORDER_NOT_FOUND: { code: '3003', message: 'Order record not found' },
  IDEMPOTENT_REPLAY_ACTIVE: {
    code: '3004',
    message: 'Duplicate transaction detected',
  },

  // Auth (4000s)
  USER_ALREADY_EXISTS: {
    code: '4001',
    message: 'Email address already registered',
  },
  INVALID_CREDENTIALS: { code: '4002', message: 'Invalid email or password' },
  TOKEN_EXPIRED: { code: '4003', message: 'Access token has expired' },
} as const;
