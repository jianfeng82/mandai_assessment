---
name: db-transaction-best-practices
description: Strict guidelines for optimizing MySQL/MariaDB transaction boundaries, preventing connection pool starvation, and avoiding unnecessary transactions. Use whenever reviewing, writing, or modifying code that involves database transactions or the `executeTransaction` block. This skill applies to MySQL/MariaDB relational databases only — do not apply to Redis MULTI blocks, MongoDB sessions, or NoSQL contexts.
---

# Database Transaction Best Practices

This skill applies to MySQL/MariaDB relational databases only. Do not apply these rules to Redis pipelines, Mongoose sessions, or any non-relational transaction context.

When writing or reviewing code that uses database transactions (such as `this.dbManager.executeTransaction`), you MUST enforce the "Fail Fast, Write Late" principle.


## 1. Never Open a Transaction for Validation

All validation checks — such as checking if a user exists, checking if a record is already completed, or verifying prerequisites — MUST be performed before opening the database transaction.


## 2. Never Perform External Network Calls Inside a Transaction

Do not place Redis queries, external API calls, or non-database I/O inside a transaction block.


## 3. Open Transactions as Late as Possible

The START TRANSACTION (or `executeTransaction` wrapper) must occur immediately before the first INSERT, UPDATE, or DELETE statement.


## 4. Mandatory Transaction Verification Procedure

Whenever you encounter an explicit transaction block, you MUST execute the following steps in order. Do not skip steps. Do not reorder steps.

STEP 1 — BUILD THE CALL LIST

List every repository or database method called inside the transaction block.

You MUST NOT classify any method as a read or write based on its name. A method named `createBattleRecord()` might execute one INSERT or it might execute three. A method named `updateStatus()` might contain a SELECT followed by an UPDATE. Method names are not evidence. Only the SQL inside the file is evidence.

STEP 2 — OPEN EVERY FILE

For each method identified in Step 1, use your file-reading tool to open the corresponding repository file and read the method body directly from source.

You are NOT permitted to proceed to Step 3 until every file on the list has been opened and every SQL statement inside each method has been read directly from source. Inferring or estimating the contents of a file is not permitted.

If a file cannot be found, do not guess its contents. Record this transaction site as UNRESOLVED and flag it to the user for manual review.

STEP 3 — COUNT WRITE QUERIES FROM SOURCE

From the file contents read in Step 2, count every INSERT, UPDATE, and DELETE statement that will execute during the transaction. Count only statements you have directly read from source. Do not infer. Do not estimate.

If a method in Step 2 calls other methods internally, repeat Steps 2 and 3 recursively for each nested method until you have accounted for all SQL at every level of the call chain.

STEP 4 — CLASSIFY THE SITE

Assign one of the following verdicts. Do not take any action on the code. Classification only.

REMOVE — The total write query count is exactly ONE. The `executeTransaction` wrapper is unnecessary because MySQL/MariaDB executes single statements atomically.

KEEP — The total write query count is TWO or more. The wrapper is required for atomicity.

UNRESOLVED — One or more repository files could not be found in Step 2. The count cannot be determined. Flag to the user for manual review.

VIOLATION: VALIDATION INSIDE TRANSACTION — The transaction block contains SELECT queries or validation logic before the first write.

VIOLATION: EXTERNAL CALL INSIDE TRANSACTION — The transaction block contains Redis queries, HTTP calls, or other non-database I/O.

A single transaction site may receive more than one verdict if multiple issues apply.


## 5. General Rules

Do not modify any file unless the prompt explicitly instructs you to.
Do not infer SQL from method names. Open the file and read the source.
Do not apply this skill to Redis MULTI blocks, Mongoose sessions, or non-relational transaction contexts.


## Why This Matters

Opening a transaction to run SELECT queries or network calls holds a database connection idle for the entire duration, wastes BEGIN/ROLLBACK overhead when validation fails early, and causes connection pool starvation under high load. Wrapping a single write query in a transaction adds unnecessary overhead with no atomicity benefit, since MySQL already guarantees single-statement atomicity natively.