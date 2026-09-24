import { Module, Global } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as mysql from 'mysql2/promise';
import databaseConfig from '../../config/database.config';
import { DatabaseManager } from './database-manager.service';

/**
 * Global Database Module providing dynamic MySQL Pool Clustering,
 * Read/Write splitting, session hardening, and connection management.
 * Directly adapted from valkyrie-nodejs (src/core/database/database.module.ts).
 */
@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CLUSTERS',
      inject: [databaseConfig.KEY],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => {
        const clusters = new Map<string, mysql.PoolCluster>();

        const createCluster = (
          writeConfig: mysql.PoolOptions,
          readConfigs: mysql.PoolOptions[],
          writeSize: number,
          readSize: number,
          idleTimeout: number,
        ) => {
          const cluster = mysql.createPoolCluster({
            canRetry: true,
            removeNodeErrorCount: 5,
          });

          // Session-level defense: enforce 10s query execution ceiling and UTC timezone
          cluster.on('connection', (connection: mysql.PoolConnection) => {
            void connection.query(
              'SET SESSION max_execution_time = 10000, time_zone = "+00:00"',
            );
          });

          // Master writer node
          cluster.add('WRITER', {
            ...writeConfig,
            connectionLimit: writeSize,
            idleTimeout,
            timezone: 'Z',
          } as mysql.PoolOptions);

          // Read replicas (or fallback replica)
          readConfigs.forEach((replica, index) => {
            cluster.add(`READER_${index}`, {
              ...replica,
              connectionLimit: readSize,
              idleTimeout,
              timezone: 'Z',
            } as mysql.PoolOptions);
          });

          return cluster;
        };

        // Dynamically instantiate clusters defined in database config
        Object.entries(dbConfig.databases).forEach(([dbName, config]) => {
          if (config.write.host) {
            clusters.set(
              dbName,
              createCluster(
                config.write,
                config.read,
                dbConfig.writePoolSize,
                dbConfig.readPoolSize,
                dbConfig.idleTimeout,
              ),
            );
          }
        });

        return clusters;
      },
    },
    DatabaseManager,
  ],
  exports: ['DATABASE_CLUSTERS', DatabaseManager],
})
export class DatabaseModule {}
