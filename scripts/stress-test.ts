/**
 * High-Concurrency Race Condition & Anti-Overselling Verification Script
 *
 * Simulates a realistic Flash Sale scenario:
 * 1. Resets target product stock to exactly 10 units.
 * 2. Authenticates 100 distinct simulated customers (each with independent user IDs & sessions).
 * 3. Fires 100 simultaneous purchase requests at the exact same millisecond.
 * 4. Asserts:
 *    - Exactly 10 requests succeed with HTTP 201 Created.
 *    - Exactly 90 requests are rejected with HTTP 409 Conflict (Out of stock).
 *    - Exactly 0 requests result in negative stock.
 *    - Database final stock is exactly 0.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const TARGET_PRODUCT_ID = 'prod-flash-sale-switch-000000001';
const INITIAL_STOCK = 10;
const CONCURRENT_BUYERS = 100;

async function runStressTest() {
  console.log('==================================================================');
  console.log('   CONCURRENCY STRESS TEST: 100 CONCURRENT USERS vs 10 UNITS STOCK ');
  console.log('==================================================================');
  console.log(`Target API        : ${API_BASE}`);
  console.log(`Target Product    : ${TARGET_PRODUCT_ID}`);
  console.log(`Initial Stock     : ${INITIAL_STOCK}`);
  console.log(`Concurrent Buyers : ${CONCURRENT_BUYERS}\n`);

  // 1. Reset target product stock to 10
  console.log('[1/4] Resetting product stock to 10 via Admin API...');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'AdminPass123!',
    }),
  });

  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${await adminLoginRes.text()}`);
  }
  const { access_token: adminToken } = (await adminLoginRes.json()) as any;

  const productRes = await fetch(`${API_BASE}/products/${TARGET_PRODUCT_ID}`);
  const product: any = await productRes.json();
  const delta = INITIAL_STOCK - product.stock;

  if (delta !== 0) {
    console.log(`Adjusting stock by ${delta > 0 ? '+' : ''}${delta}...`);
    const adjustRes = await fetch(
      `${API_BASE}/admin/products/${TARGET_PRODUCT_ID}/stock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ amount: delta, reason: 'CONCURRENCY_TEST_RESET' }),
      },
    );
    if (!adjustRes.ok) {
      throw new Error(`Failed to adjust stock: ${await adjustRes.text()}`);
    }
  }

  // 2. Prepare 100 distinct customer tokens
  console.log(`[2/4] Authenticating ${CONCURRENT_BUYERS} distinct customer accounts...`);
  const userTokens: string[] = [];

  // Register / login 100 distinct customer accounts
  const authPromises = Array.from({ length: CONCURRENT_BUYERS }, async (_, i) => {
    const email = `buyer_${i + 1}_${Date.now()}@flashtest.com`;
    const password = 'TestCustomer123!';

    try {
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (regRes.ok) {
        const data: any = await regRes.json();
        return data.access_token;
      }

      // If already registered, login
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: any = await loginRes.json();
      return data.access_token;
    } catch (e: any) {
      console.error(`Auth failed for ${email}:`, e.message);
      return null;
    }
  });

  const authResults = await Promise.all(authPromises);
  for (const token of authResults) {
    if (token) userTokens.push(token);
  }

  console.log(`Successfully authenticated ${userTokens.length} distinct buyers.`);

  // 3. Fire all 100 purchase requests simultaneously
  console.log(
    `[3/4] Firing ${userTokens.length} simultaneous purchase requests at the exact same millisecond...`,
  );
  const startTime = Date.now();

  const buyPromises = userTokens.map(async (token, index) => {
    const idempotencyKey = `concurrency-run-${Date.now()}-buyer-${index}`;
    try {
      const res = await fetch(`${API_BASE}/orders/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          productId: TARGET_PRODUCT_ID,
          quantity: 1,
        }),
      });

      return {
        status: res.status,
        body: (await res.json()) as any,
      };
    } catch (err: any) {
      return {
        status: 0,
        body: { error: err.message },
      };
    }
  });

  const results = await Promise.all(buyPromises);
  const elapsedMs = Date.now() - startTime;

  // 4. Verify outcomes
  console.log('\n[4/4] Validating Inventory Integrity & Zero-Overselling...');
  let successCount = 0;
  let conflictCount = 0;
  let unexpectedCount = 0;

  for (const r of results) {
    if (r.status === 201) {
      successCount++;
    } else if (r.status === 409) {
      conflictCount++;
    } else {
      unexpectedCount++;
      console.warn(`Unexpected HTTP ${r.status}:`, r.body);
    }
  }

  // Check database state directly
  const finalProductRes = await fetch(`${API_BASE}/products/${TARGET_PRODUCT_ID}`);
  const finalProduct: any = await finalProductRes.json();

  console.log('\n==================================================================');
  console.log('                       STRESS TEST REPORT                         ');
  console.log('==================================================================');
  console.log(`Total Concurrent Requests Sent : ${userTokens.length}`);
  console.log(`Total Batch Execution Time     : ${elapsedMs} ms`);
  console.log(
    `Average Latency Per Request    : ${(elapsedMs / userTokens.length).toFixed(1)} ms`,
  );
  console.log(
    `Successful Orders (HTTP 201)   : ${successCount} (Target: Exactly ${INITIAL_STOCK})`,
  );
  console.log(
    `Out-of-Stock Blocks (HTTP 409) : ${conflictCount} (Target: Exactly ${userTokens.length - INITIAL_STOCK})`,
  );
  console.log(`Errors / Unexpected Status     : ${unexpectedCount}`);
  console.log(`Initial Available Stock        : ${INITIAL_STOCK}`);
  console.log(
    `Final Database Stock Balance   : ${finalProduct.stock} (Target: Exactly 0)`,
  );

  const isSuccess =
    successCount === INITIAL_STOCK &&
    conflictCount === userTokens.length - INITIAL_STOCK &&
    finalProduct.stock === 0 &&
    unexpectedCount === 0;

  if (isSuccess) {
    console.log('\n' + '='.repeat(66));
    console.log(' SUCCESS: ZERO OVERSELLING DETECTED!                             ');
    console.log(' The Atomic Conditional Update prevented 100% of race conditions!');
    console.log(''.padEnd(66, '='));
  } else {
    console.error('\n FAILURE: Inventory mismatch or overselling detected!');
    process.exit(1);
  }
}

runStressTest().catch((err) => {
  console.error('Fatal stress test failure:', err);
  process.exit(1);
});
