// API Client Configuration

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Product {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  total_cents: number;
  idempotency_key: string | null;
  created_at: string;
  items: OrderItem[];
  user?: { email: string };
}

export interface InventoryLog {
  id: string;
  product_id: string;
  change_amount: number;
  balance_after: number;
  reason: 'PURCHASE' | 'ADMIN_RESTOCK' | 'ADMIN_ADJUSTMENT' | 'ORDER_CANCELLED';
  reference_id: string | null;
  created_at: string;
  product?: Product;
}

export const api = {
  // Authentication
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || 'Login failed');
    }
    return res.json();
  },

  async register(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(err.message || 'Registration failed');
    }
    return res.json();
  },

  // Public Catalog
  async getProducts(search?: string): Promise<Product[]> {
    const url = new URL(`${API_BASE}/products`);
    if (search) url.searchParams.set('search', search);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async getProduct(id: string): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  // Buy Endpoint
  async buy(productId: string, quantity: number, token: string, idempotencyKey?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch(`${API_BASE}/orders/buy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId, quantity }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body.message || `Purchase failed (${res.status})`);
      (error as any).status = res.status;
      (error as any).body = body;
      throw error;
    }

    return body;
  },

  async getMyOrders(token: string): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders/my-orders`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  // Admin Endpoints
  async adminGetProducts(token: string, search?: string): Promise<Product[]> {
    const url = new URL(`${API_BASE}/admin/products`);
    if (search) url.searchParams.set('search', search);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch admin products');
    return res.json();
  },

  async adminCreateProduct(
    token: string,
    data: {
      title: string;
      description?: string;
      price_cents: number;
      stock: number;
    },
  ): Promise<Product> {
    const res = await fetch(`${API_BASE}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create product');
    }
    return res.json();
  },

  async adminAdjustStock(
    token: string,
    productId: string,
    amount: number,
    reason?: string,
  ): Promise<Product> {
    const res = await fetch(`${API_BASE}/admin/products/${productId}/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount, reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to adjust stock');
    }
    return res.json();
  },

  async adminToggleActive(
    token: string,
    productId: string,
    is_active: boolean,
  ): Promise<Product> {
    const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  async adminGetOrders(token: string): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch admin orders');
    return res.json();
  },

  async adminGetInventoryLogs(
    token: string,
    productId?: string,
  ): Promise<InventoryLog[]> {
    const url = new URL(`${API_BASE}/admin/inventory/logs`);
    if (productId) url.searchParams.set('productId', productId);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch inventory logs');
    return res.json();
  },
};
