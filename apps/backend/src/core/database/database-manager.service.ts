import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { withTransactionRetry } from './with-retry.util';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Enterprise Database Manager providing read/write splitting,
 * read-after-write master consistency, and self-healing transactions.
 */
@Injectable()
export class DatabaseManager implements OnModuleDestroy {
  constructor(
    @Inject('DATABASE_CLUSTERS')
    private readonly clusters: Map<string, mysql.PoolCluster>,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Resolves the physical connection cluster for the specified database namespace.
   */
  public getCluster(dbName = 'app'): mysql.PoolCluster {
    const cluster = this.clusters.get(dbName);
    if (!cluster) {
      throw new Error(
        `CRITICAL: Database cluster '${dbName}' is not configured in the environment.`,
      );
    }
    return cluster;
  }

  /**
   * READ OPERATION
   * Automatically routes to the Reader Endpoint (READER*) or provided transaction connection.
   */
  async read<T>(
    dbName = 'app',
    sql: string,
    params: any[] = [],
    connection?: mysql.PoolConnection,
  ): Promise<T> {
    const executor = connection || this.getCluster(dbName).of('READER*');
    const [rows] = await executor.query(sql, params);
    return rows as T;
  }

  /**
   * CRITICAL READ (Read-After-Write Consistency)
   * Forces a read directly from the Writer Endpoint (WRITER) to guarantee zero replication lag.
   */
  async readMaster<T>(
    dbName = 'app',
    sql: string,
    params: any[] = [],
    connection?: mysql.PoolConnection,
  ): Promise<T> {
    const executor = connection || this.getCluster(dbName).of('WRITER');
    const [rows] = await executor.query(sql, params);
    return rows as T;
  }

  /**
   * WRITE OPERATION
   * Routes DML directly to the Writer Endpoint (WRITER) using prepared statements (execute).
   */
  async write<T>(
    dbName = 'app',
    sql: string,
    params: any[] = [],
    connection?: mysql.PoolConnection,
  ): Promise<T> {
    const executor = connection || this.getCluster(dbName).of('WRITER');
    const [result] = await executor.execute(sql, params);
    return result as T;
  }

  /**
   * ACID TRANSACTION
   * Locks to the Writer Endpoint, runs the callback passing the connection,
   * automatically commits on success, rolls back on error, and retries on transient locks.
   */
  async executeTransaction<T>(
    dbName = 'app',
    operation: (connection: mysql.PoolConnection) => Promise<T>,
  ): Promise<T> {
    return withTransactionRetry(
      async () => {
        const masterPool = this.getCluster(dbName).of('WRITER');
        const connection = await masterPool.getConnection();

        try {
          await connection.beginTransaction();

          const result = await operation(connection);

          await connection.commit();
          return result;
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      },
      3,
      50,
      this.logger,
    );
  }

  /**
   * Gracefully close all MySQL Pool Clusters on application shutdown.
   */
  async onModuleDestroy() {
    this.logger.log(
      'Shutting down DatabaseManager: Closing all MySQL Pool Clusters...',
      'DatabaseManager',
    );

    for (const [dbName, cluster] of this.clusters.entries()) {
      try {
        await cluster.end();
        this.logger.log(`Closed MySQL cluster: ${dbName}`, 'DatabaseManager');
      } catch (error) {
        this.logger.error(
          `Error closing MySQL cluster ${dbName}:`,
          error instanceof Error ? error.stack : String(error),
          'DatabaseManager',
        );
      }
    }
  }
}
