import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserEntity, UserRole } from './entities/user.entity';

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockUser: UserEntity = {
    id: 'usr-test-001',
    email: 'test@example.com',
    password_hash: '',
    role: UserRole.CUSTOMER,
    created_at: new Date(),
    updated_at: new Date(),
  };

  let mockQueryBuilder: any;
  let mockUserRepository: any;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock_jwt_token_xyz'),
  };

  beforeAll(async () => {
    mockUser.password_hash = await bcrypt.hash('CorrectPass123!', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockUserRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password_hash when credentials are valid', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ ...mockUser });

      const result = await service.validateUser(
        'test@example.com',
        'CorrectPass123!',
      );
      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect((result as any).password_hash).toBeUndefined();
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ ...mockUser });

      await expect(
        service.validateUser('test@example.com', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.validateUser('unknown@example.com', 'SomePass123!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access_token and user info', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ ...mockUser });

      const result = await service.login({
        email: 'test@example.com',
        password: 'CorrectPass123!',
      });

      expect(result.access_token).toBe('mock_jwt_token_xyz');
      expect(result.user.email).toBe('test@example.com');
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should throw ConflictException if email is already taken', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser });

      await expect(
        service.register('test@example.com', 'Password123!'),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully register a new user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        id: 'usr-new-001',
        email: 'newuser@example.com',
        role: UserRole.CUSTOMER,
      });
      mockUserRepository.save.mockResolvedValue({
        id: 'usr-new-001',
        email: 'newuser@example.com',
        role: UserRole.CUSTOMER,
      });
      mockQueryBuilder.getOne.mockResolvedValue({
        ...mockUser,
        email: 'newuser@example.com',
      });

      const result = await service.register(
        'newuser@example.com',
        'CorrectPass123!',
      );

      expect(result.access_token).toBe('mock_jwt_token_xyz');
      expect(result.user.email).toBe('newuser@example.com');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });
});
