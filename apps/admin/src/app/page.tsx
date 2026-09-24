'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, Product, Order, InventoryLog } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Plus,
  RefreshCw,
  Edit3,
  Archive,
  History,
  ShoppingBag,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, token, quickLogin } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'logs'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Modals state
  const [stockModal, setStockModal] = useState<{
    open: boolean;
    product: Product | null;
    amount: number;
    reason: string;
  }>({ open: false, product: null, amount: 10, reason: 'MANUAL_RESTOCK' });

  const [createModal, setCreateModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    price: string;
    stock: number;
  }>({ open: false, title: '', description: '', price: '49.99', stock: 20 });

  const loadData = useCallback(async () => {
    const currentToken = token || localStorage.getItem('mandai_auth_token');
    if (!currentToken) return;

    setLoading(true);
    try {
      if (activeTab === 'products') {
        const data = await api.adminGetProducts(currentToken);
        setProducts(data);
      } else if (activeTab === 'orders') {
        const data = await api.adminGetOrders(currentToken);
        setOrders(data);
      } else if (activeTab === 'logs') {
        const data = await api.adminGetInventoryLogs(currentToken);
        setLogs(data);
      }
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, token]);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  const handleAdjustStock = async () => {
    if (!stockModal.product || !token) return;
    try {
      await api.adminAdjustStock(
        token,
        stockModal.product.id,
        stockModal.amount,
        stockModal.reason,
      );
      setStockModal({ ...stockModal, open: false });
      setMsg(`Stock for '${stockModal.product.title}' successfully updated!`);
      loadData();
    } catch (err: any) {
      alert(`Error updating stock: ${err.message}`);
    }
  };

  const handleCreateProduct = async () => {
    if (!token) return;
    try {
      const priceCents = Math.round(parseFloat(createModal.price) * 100);
      await api.adminCreateProduct(token, {
        title: createModal.title,
        description: createModal.description,
        price_cents: priceCents,
        stock: createModal.stock,
      });
      setCreateModal({ ...createModal, open: false, title: '', description: '' });
      setMsg(`Product '${createModal.title}' successfully created!`);
      loadData();
    } catch (err: any) {
      alert(`Error creating product: ${err.message}`);
    }
  };

  const handleToggleActive = async (p: Product) => {
    if (!token) return;
    try {
      await api.adminToggleActive(token, p.id, !p.is_active);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-10">
          <LayoutDashboard className="mx-auto h-12 w-12 text-indigo-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Admin Authorization Required
          </h2>
          <p className="text-sm text-zinc-400 mb-6">
            The inventory management portal is restricted to users with the{' '}
            <code className="text-indigo-300 font-mono">ADMIN</code> role.
          </p>
          <button
            onClick={() => quickLogin('ADMIN')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all"
          >
            Switch to Admin Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <LayoutDashboard className="h-6 w-6 text-indigo-400" />
            Inventory & Catalog Administration
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage inventory levels, audit stock modifications, and inspect platform
            purchases
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateModal({ ...createModal, open: true })}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Product
          </button>
          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {msg && (
        <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-4 text-xs font-semibold text-indigo-300 flex justify-between items-center">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-zinc-500 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'products'
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Package className="h-4 w-4" />
          Products & Stock
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'orders'
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Orders Stream
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logs'
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <History className="h-4 w-4" />
          Audit Ledger ({logs.length})
        </button>
      </div>

      {/* Tab 1: Products Table */}
      {activeTab === 'products' && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Product Title</th>
                <th className="px-6 py-3.5">Price</th>
                <th className="px-6 py-3.5">Stock Available</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-850/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-white block">{p.title}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{p.id}</span>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-white">
                    ${(p.price_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold ${
                        p.stock === 0
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : p.stock <= 5
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {p.stock} units
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block h-2 w-2 rounded-full mr-2 ${
                        p.is_active ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                    {p.is_active ? 'Active' : 'Archived'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() =>
                        setStockModal({
                          open: true,
                          product: p,
                          amount: 10,
                          reason: 'ADMIN_MANUAL_RESTOCK',
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                    >
                      <Edit3 className="h-3 w-3" />
                      Adjust Stock
                    </button>
                    <button
                      onClick={() => handleToggleActive(p)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Archive className="h-3 w-3" />
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Orders Stream */}
      {activeTab === 'orders' && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Order ID</th>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Items</th>
                <th className="px-6 py-3.5">Total Paid</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-850/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-zinc-400">{o.id}</td>
                  <td className="px-6 py-4 font-medium text-white">
                    {o.user?.email || o.user_id}
                  </td>
                  <td className="px-6 py-4">
                    {o.items?.map((it) => (
                      <span key={it.id} className="block">
                        {it.product?.title || it.product_id} (Qty: {it.quantity})
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                    ${(o.total_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Inventory Audit Ledger */}
      {activeTab === 'logs' && (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Product</th>
                <th className="px-6 py-3.5">Change Amount</th>
                <th className="px-6 py-3.5">Balance After</th>
                <th className="px-6 py-3.5">Reason Code</th>
                <th className="px-6 py-3.5">Reference ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-850/50 transition-colors">
                  <td className="px-6 py-4 text-zinc-500 font-mono">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-bold text-white">
                    {l.product?.title || l.product_id}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold">
                    {l.change_amount > 0 ? (
                      <span className="text-emerald-400 inline-flex items-center gap-0.5">
                        <ArrowUpRight className="h-3 w-3" /> +{l.change_amount}
                      </span>
                    ) : (
                      <span className="text-rose-400 inline-flex items-center gap-0.5">
                        <ArrowDownRight className="h-3 w-3" /> {l.change_amount}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-white">
                    {l.balance_after} units
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                      {l.reason}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">
                    {l.reference_id || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {stockModal.open && stockModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Adjust Inventory Stock
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Item:{' '}
              <span className="text-white font-semibold">{stockModal.product.title}</span>{' '}
              (Current: {stockModal.product.stock})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Stock Change Amount (positive to add, negative to reduce)
                </label>
                <input
                  type="number"
                  value={stockModal.amount}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, amount: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Audit Reason
                </label>
                <input
                  type="text"
                  value={stockModal.reason}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, reason: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStockModal({ ...stockModal, open: false })}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustStock}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md"
                >
                  Commit Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {createModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">
              Add New Product to Catalog
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Product Title
                </label>
                <input
                  type="text"
                  value={createModal.title}
                  onChange={(e) =>
                    setCreateModal({ ...createModal, title: e.target.value })
                  }
                  placeholder="e.g. Wireless Gaming Mouse"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={createModal.description}
                  onChange={(e) =>
                    setCreateModal({ ...createModal, description: e.target.value })
                  }
                  placeholder="Key features and specifications..."
                  rows={3}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Price (USD)
                  </label>
                  <input
                    type="text"
                    value={createModal.price}
                    onChange={(e) =>
                      setCreateModal({ ...createModal, price: e.target.value })
                    }
                    placeholder="49.99"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createModal.stock}
                    onChange={(e) =>
                      setCreateModal({ ...createModal, stock: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setCreateModal({ ...createModal, open: false })}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProduct}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md"
                >
                  Create Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
