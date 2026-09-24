'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, Product, Order } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  ShoppingBag,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  Package,
} from 'lucide-react';
import Link from 'next/link';

export default function StorefrontPage() {
  const { token, quickLogin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [lastOrder, setLastOrder] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showOrders, setShowOrders] = useState(false);

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProducts(search);
      setProducts(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchMyOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getMyOrders(token);
      setOrders(data);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    if (token) fetchMyOrders();
  }, [token, fetchMyOrders]);

  const handleBuy = async (product: Product) => {
    if (!token) {
      await quickLogin('CUSTOMER');
    }
    const currentToken = token || localStorage.getItem('mandai_auth_token');
    if (!currentToken) return;

    const qty = quantities[product.id] || 1;
    const idempotencyKey = `web-buy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setBuyingId(product.id);
    setErrorMsg(null);
    setLastOrder(null);

    try {
      const result = await api.buy(product.id, qty, currentToken, idempotencyKey);
      setLastOrder(result);
      // Refresh products to show updated stock
      fetchCatalog();
      fetchMyOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
      fetchCatalog();
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900/60 to-zinc-950 p-8 sm:p-10 mb-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            Strict Atomic Concurrency Control (InnoDB Test-and-Set)
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Real-Time Storefront with Zero-Overselling Guarantee
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 mb-6 leading-relaxed">
            Every purchase executes directly against MySQL InnoDB using atomic conditional
            logic (
            <code className="text-indigo-300 font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded text-xs">
              WHERE stock &gt;= :qty
            </code>
            ), paired with Redis idempotency keys and per-user distributed locks.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02]"
            >
              <Zap className="h-4 w-4" />
              Launch Concurrency Flash Sale Lab (100 Users)
            </Link>
            <button
              onClick={() => setShowOrders(!showOrders)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              {showOrders ? 'Hide My Orders' : `My Orders (${orders.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Purchase Notification Banner */}
      {lastOrder && (
        <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-5 backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-300">
                  Purchase Succeeded & Stock Reserved!
                </h3>
                {lastOrder.is_idempotent_replay && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    Idempotent Replay
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-zinc-300 space-y-1">
                <p>
                  Order ID: <span className="font-mono text-white">{lastOrder.id}</span>
                </p>
                <p>
                  Item:{' '}
                  <span className="font-semibold text-white">
                    {lastOrder.item?.title}
                  </span>{' '}
                  (Qty: {lastOrder.item?.quantity}) • Total Paid:{' '}
                  <span className="font-semibold text-emerald-400">
                    ${lastOrder.total_dollars}
                  </span>
                </p>
                <p>
                  Remaining Stock in Warehouse:{' '}
                  <span className="font-bold text-white">
                    {lastOrder.remaining_stock}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setLastOrder(null)}
              className="text-zinc-500 hover:text-zinc-300 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-8 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 backdrop-blur-md animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <div className="flex-1 text-sm font-medium text-rose-300">{errorMsg}</div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-zinc-500 hover:text-zinc-300 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* My Orders Drawer */}
      {showOrders && (
        <div className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-indigo-400" />
            My Order Receipts ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-zinc-500">No orders placed yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-400">{o.id}</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        {o.status}
                      </span>
                    </div>
                    <div className="mt-1 text-zinc-300">
                      {o.items?.map((it) => (
                        <span key={it.id}>
                          {it.product?.title || 'Product'} (Qty: {it.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">
                      ${(o.total_cents / 100).toFixed(2)}
                    </span>
                    <p className="text-[11px] text-zinc-500">
                      {new Date(o.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Catalog Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Active Product Catalog
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time stock counts synced directly with MySQL storage
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-zinc-800 bg-zinc-900/30 animate-pulse"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border border-zinc-800/80 rounded-2xl bg-zinc-900/20">
          <Package className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-400">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => {
            const isSoldOut = p.stock <= 0;
            const isLowStock = p.stock > 0 && p.stock <= 5;
            const isFlashSale = p.id.includes('flash-sale');

            return (
              <div
                key={p.id}
                className={`group relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${
                  isFlashSale
                    ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/20 via-zinc-900/80 to-zinc-950 shadow-lg shadow-amber-950/10'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {isFlashSale ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
                        <Sparkles className="h-3 w-3" />
                        Flash Sale Item
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Hardware Catalog
                      </span>
                    )}

                    {/* Stock Status Badge */}
                    {isSoldOut ? (
                      <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/20">
                        Sold Out
                      </span>
                    ) : isLowStock ? (
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20 animate-pulse">
                        Low Stock: {p.stock} left
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                        In Stock: {p.stock} units
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/60">
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="text-xs text-zinc-500">Price</span>
                    <span className="text-2xl font-black tracking-tight text-white">
                      ${(p.price_cents / 100).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity and Buy Button */}
                  <div className="flex items-center gap-2">
                    {!isSoldOut && (
                      <select
                        value={quantities[p.id] || 1}
                        onChange={(e) =>
                          setQuantities({ ...quantities, [p.id]: Number(e.target.value) })
                        }
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {Array.from(
                          { length: Math.min(p.stock, 5) },
                          (_, idx) => idx + 1,
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      disabled={isSoldOut || buyingId === p.id}
                      onClick={() => handleBuy(p)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-sm font-bold transition-all ${
                        isSoldOut
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
                          : buyingId === p.id
                            ? 'bg-indigo-700 text-white cursor-wait opacity-80'
                            : isFlashSale
                              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02]'
                              : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:scale-[1.02]'
                      }`}
                    >
                      {buyingId === p.id ? (
                        <>
                          <Clock className="h-4 w-4 animate-spin" />
                          Reserving...
                        </>
                      ) : isSoldOut ? (
                        'Out of Stock'
                      ) : (
                        <>
                          <ShoppingBag className="h-4 w-4" />
                          Buy Securely
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
