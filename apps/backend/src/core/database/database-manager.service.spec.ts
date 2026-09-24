import { DatabaseManager } from './database-manager.service';

describe('DatabaseManager (Valkyrie Core Database Engine)', () => {
  let service: DatabaseManager;
  let mockCluster: any;
  let mockWriterPool: any;
  let mockReaderPool: any;
  let mockConnection: any;
  let mockLogger: any;
  let clusters: Map<string, any>;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn().mockResolvedValue([[{ id: 1, name: 'test' }]]),
      execute: jest
        .fn()
        .mockResolvedValue([{ affectedRows: 1, insertId: 100 }]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockReturnValue(undefined),
    };

    mockWriterPool = {
      query: jest.fn().mockResolvedValue([[{ id: 1, name: 'master_read' }]]),
      execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
      getConnection: jest.fn().mockResolvedValue(mockConnection),
    };

    mockReaderPool = {
      query: jest.fn().mockResolvedValue([[{ id: 1, name: 'replica_read' }]]),
    };

    mockCluster = {
      of: jest.fn().mockImplementation((pattern: string) => {
        if (pattern === 'WRITER') return mockWriterPool;
        return mockReaderPool;
      }),
      end: jest.fn().mockResolvedValue(undefined),
    };

    clusters = new Map<string, any>();
    clusters.set('app', mockCluster);

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new DatabaseManager(clusters, mockLogger);
  });

  describe('Read / Write Routing', () => {
    it('should route read() to READER* pool cluster', async () => {
      const result = await service.read<{ id: number }[]>(
        'app',
        'SELECT * FROM products',
      );
      expect(mockCluster.of).toHaveBeenCalledWith('READER*');
      expect(mockReaderPool.query).toHaveBeenCalledWith(
        'SELECT * FROM products',
        [],
      );
      expect(result).toEqual([{ id: 1, name: 'replica_read' }]);
    });

    it('should route readMaster() directly to WRITER pool cluster', async () => {
      const result = await service.readMaster<{ id: number }[]>(
        'app',
        'SELECT * FROM products WHERE id = ?',
        [1],
      );
      expect(mockCluster.of).toHaveBeenCalledWith('WRITER');
      expect(mockWriterPool.query).toHaveBeenCalledWith(
        'SELECT * FROM products WHERE id = ?',
        [1],
      );
      expect(result).toEqual([{ id: 1, name: 'master_read' }]);
    });

    it('should route write() to WRITER pool cluster with prepared statement', async () => {
      const result = await service.write(
        'app',
        'UPDATE products SET stock = ? WHERE id = ?',
        [10, 1],
      );
      expect(mockCluster.of).toHaveBeenCalledWith('WRITER');
      expect(mockWriterPool.execute).toHaveBeenCalledWith(
        'UPDATE products SET stock = ? WHERE id = ?',
        [10, 1],
      );
      expect(result).toEqual({ affectedRows: 1 });
    });

    it('should use provided active connection if passed to read/write methods', async () => {
      await service.read('app', 'SELECT 1', [], mockConnection);
      expect(mockConnection.query).toHaveBeenCalledWith('SELECT 1', []);
      expect(mockCluster.of).not.toHaveBeenCalled();

      await service.write('app', 'UPDATE test SET a = 1', [], mockConnection);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE test SET a = 1',
        [],
      );
    });

    it('should throw critical error if requested cluster is not configured', () => {
      expect(() => service.getCluster('non_existent')).toThrow(
        /CRITICAL: Database cluster 'non_existent' is not configured/,
      );
    });
  });

  describe('ACID Transaction Management', () => {
    it('should execute transaction, commit, and release connection on success', async () => {
      const result = await service.executeTransaction('app', async (conn) => {
        await conn.execute('UPDATE products SET stock = stock - 1');
        return { success: true };
      });

      expect(mockCluster.of).toHaveBeenCalledWith('WRITER');
      expect(mockWriterPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should rollback transaction and release connection on error', async () => {
      await expect(
        service.executeTransaction('app', async () => {
          await Promise.resolve();
          throw new Error('Business error inside transaction');
        }),
      ).rejects.toThrow('Business error inside transaction');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle Shutdown (onModuleDestroy)', () => {
    it('should gracefully drain and close all MySQL pool clusters', async () => {
      await service.onModuleDestroy();
      expect(mockCluster.end).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Closing all MySQL Pool Clusters'),
        'DatabaseManager',
      );
    });
  });
});
