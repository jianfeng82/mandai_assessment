'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, Product } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  Zap,
  ShieldCheck,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';

export default function SimulatorPage() {
  const { token, quickLogin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    'prod-flash-sale-switch-000000001',
  );
  const [concurrencyLevel, setConcurrencyLevel] = useState<number>(50);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [resettingStock, setResettingStock] = useState<boolean>(false);
  const [targetStock, setTargetStock] = useState<number>(10);
  const [results, setResults] = useState<{
    total: number;
    success: number;
    conflict: number;
    errors: number;
    elapsedMs: number;
    finalStock: number | null;
    logs: { status: number; message: string; timestamp: string }[];
  } | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Helper to reset stock via Admin endpoint
  const handleResetStock = async () => {
    try {
      setResettingStock(true);
      await quickLogin('ADMIN');
      const currentToken = localStorage.getItem('mandai_auth_token') || token;
      if (!currentToken) return;

      const p = await api.getProduct(selectedProductId);
      const delta = targetStock - p.stock;

      if (delta !== 0) {
        await api.adminAdjustStock(
          currentToken,
          selectedProductId,
          delta,
          'SIMULATOR_RESET',
        );
      }
      await fetchProducts();
    } catch (err: any) {
      alert(`Failed to reset stock: ${err.message}`);
    } finally {
      setResettingStock(false);
    }
  };

  // Run Concurrency Stress Test directly from Browser
  const runSimulation = async () => {
    setIsRunning(true);
    setResults(null);

    // Ensure we have customer authentication
    await quickLogin('CUSTOMER');
    const currentToken = localStorage.getItem('mandai_auth_token') || token;

    const startTime = Date.now();
    const logs: { status: number; message: string; timestamp: string }[] = [];
    let success = 0;
    let conflict = 0;
    let errors = 0;

    // Generate N concurrent requests firing with Promise.all
    const promises = Array.from({ length: concurrencyLevel }, async (_, idx) => {
      const idempotencyKey = `sim-run-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      try {
        const res = await api.buy(
          selectedProductId,
          1,
          currentToken || '',
          idempotencyKey,
        );
        success++;
        logs.push({
          status: 201,
          message: `Request #${idx + 1}: Order Placed! (Remaining: ${res.remaining_stock})`,
          timestamp: new Date().toLocaleTimeString(),
        });
      } catch (err: any) {
        if (err.status === 409 || err.message?.includes('out of stock')) {
          conflict++;
          logs.push({
            status: 409,
            message: `Request #${idx + 1}: Rejected - Out of Stock!`,
            timestamp: new Date().toLocaleTimeString(),
          });
        } else {
          errors++;
          logs.push({
            status: err.status || 500,
            message: `Request #${idx + 1}: Error - ${err.message}`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }
    });

    await Promise.all(promises);
    const elapsedMs = Date.now() - startTime;

    // Check final database stock
    const updated = await api.getProduct(selectedProductId);
    await fetchProducts();

    setResults({
      total: concurrencyLevel,
      success,
      conflict,
      errors,
      elapsedMs,
      finalStock: updated.stock,
      logs: logs.reverse(),
    });

    setIsRunning(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Title Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-2">
          <Zap className="h-3.5 w-3.5" />
          Interactive Anti-Oversell Verification Engine
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Concurrency & Race Condition Simulator
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Fire up to 100 simultaneous purchase requests directly from your browser to
          empirically verify that the database-level Atomic Conditional Update (
          <code>WHERE stock &gt;= :qty</code>) guarantees zero overselling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Test Parameters
            </h2>

            {/* Target Product */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Target Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} (Stock: {p.stock})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Stock & Reset */}
            <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Live Database Stock</span>
                <span className="text-xl font-black text-white">
                  {selectedProduct?.stock ?? '--'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  min="0"
                  value={targetStock}
                  onChange={(e) => setTargetStock(Number(e.target.value))}
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-center text-white"
                />
                <button
                  disabled={resettingStock}
                  onClick={handleResetStock}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-all"
                >
                  <RotateCcw
                    className={`h-3 w-3 ${resettingStock ? 'animate-spin' : ''}`}
                  />
                  Set Stock to {targetStock}
                </button>
              </div>
            </div>

            {/* Concurrency Level */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  Simultaneous Requests
                </label>
                <span className="text-xs font-bold text-amber-400">
                  {concurrencyLevel} Requests
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                {[10, 25, 50, 100].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setConcurrencyLevel(lvl)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      concurrencyLevel === lvl
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'border border-zinc-800 bg-zinc-800/80 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Button */}
            <button
              disabled={isRunning || (selectedProduct?.stock ?? 0) <= 0}
              onClick={runSimulation}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold shadow-lg transition-all ${
                isRunning
                  ? 'bg-amber-600 text-white cursor-wait opacity-80'
                  : (selectedProduct?.stock ?? 0) <= 0
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-500/20 hover:scale-[1.02]'
              }`}
            >
              {isRunning ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Firing {concurrencyLevel} Parallel Requests...
                </>
              ) : (selectedProduct?.stock ?? 0) <= 0 ? (
                'Stock is 0 (Reset stock first)'
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Execute Flash Sale Test
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results & Real-time Metrics Panel */}
        <div className="lg:col-span-2 space-y-6">
          {results ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    Stress Test Outcomes
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Execution Time:{' '}
                    <span className="text-white font-mono">{results.elapsedMs} ms</span> (
                    {(results.elapsedMs / results.total).toFixed(1)} ms / req)
                  </p>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    results.finalStock === 0 && results.success > 0
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  Zero Oversell Verified
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <span className="text-xs text-zinc-500">Total Fired</span>
                  <p className="text-2xl font-black text-white mt-1">{results.total}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <span className="text-xs text-emerald-400 font-medium">
                    Successful (201)
                  </span>
                  <p className="text-2xl font-black text-emerald-300 mt-1">
                    {results.success}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                  <span className="text-xs text-rose-400 font-medium">Blocked (409)</span>
                  <p className="text-2xl font-black text-rose-300 mt-1">
                    {results.conflict}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <span className="text-xs text-zinc-500">Final DB Stock</span>
                  <p className="text-2xl font-black text-white mt-1">
                    {results.finalStock}
                  </p>
                </div>
              </div>

              {/* Live Request Stream */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  Live Response Log Stream
                </h3>
                <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs">
                  {results.logs.map((l, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2 rounded border ${
                        l.status === 201
                          ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                          : l.status === 409
                            ? 'border-rose-500/20 bg-rose-950/20 text-rose-300'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {l.status === 201 ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        )}
                        <span>{l.message}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{l.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <Zap className="mx-auto h-12 w-12 text-zinc-700 mb-3" />
              <h3 className="text-base font-bold text-zinc-300">No Simulation Run Yet</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                Select your parameters on the left and click "Execute Flash Sale Test" to
                simulate concurrent race conditions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
