import { registerAs } from '@nestjs/config';

/**
 * Database cluster configuration factory.
 */
export default registerAs('database', () => {
  const writeHost =
    process.env.DB_APP_WRITE_HOST || process.env.DB_HOST || '127.0.0.1';
  const writePort = parseInt(
    process.env.DB_APP_WRITE_PORT || process.env.DB_PORT || '3306',
    10,
  );
  const writeUser =
    process.env.DB_APP_WRITE_USER || process.env.DB_USER || 'appuser';
  const writePassword =
    process.env.DB_APP_WRITE_PASSWORD ||
    process.env.DB_PASSWORD ||
    'apppassword';
  const writeDatabase =
    process.env.DB_APP_WRITE_DATABASE || process.env.DB_NAME || 'product_db';

  const readHost = process.env.DB_APP_READ_HOST || writeHost;
  const readPort = parseInt(
    process.env.DB_APP_READ_PORT || String(writePort),
    10,
  );
  const readUser = process.env.DB_APP_READ_USER || writeUser;
  const readPassword = process.env.DB_APP_READ_PASSWORD || writePassword;
  const readDatabase = process.env.DB_APP_READ_DATABASE || writeDatabase;

  return {
    writePoolSize: parseInt(process.env.DB_WRITE_POOL_SIZE || '10', 10),
    readPoolSize: parseInt(process.env.DB_READ_POOL_SIZE || '10', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '600000', 10),
    databases: {
      app: {
        write: {
          host: writeHost,
          port: writePort,
          user: writeUser,
          password: writePassword,
          database: writeDatabase,
        },
        read: [
          {
            host: readHost,
            port: readPort,
            user: readUser,
            password: readPassword,
            database: readDatabase,
          },
        ],
      },
    },
  };
});
