import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UserProfile, DefaultSplitType } from './profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrencyService } from '../modules/currency/currency.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let repository: Repository<UserProfile>;
  let currencyService: CurrencyService;

  const walletAddress = 'GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM';
  const mockProfile: UserProfile = {
    walletAddress,
    displayName: 'Alice',
    email: null,
    avatarUrl: null,
    avatarThumbUrl: null,
    bio: null,
    preferredCurrency: 'USD',
    defaultSplitType: DefaultSplitType.EQUAL,
    emailNotifications: true,
    pushNotifications: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({ ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
  };

  const mockCurrencyService = {
    getSupportedCurrencies: jest.fn().mockReturnValue(['USD', 'EUR', 'XLM', 'USDC']),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepository.findOne.mockResolvedValue(mockProfile);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: getRepositoryToken(UserProfile),
          useValue: mockRepository,
        },
        {
          provide: CurrencyService,
          useValue: mockCurrencyService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    repository = module.get<Repository<UserProfile>>(getRepositoryToken(UserProfile));
    currencyService = module.get<CurrencyService>(CurrencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByWalletAddress', () => {
    it('should return profile when found', async () => {
      const result = await service.getByWalletAddress(walletAddress);
      expect(result).toEqual(mockProfile);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { walletAddress },
      });
    });

    it('should throw NotFoundException for unknown wallet address', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.getByWalletAddress('GUNKNOWN123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getByWalletAddress('GUNKNOWN123')).rejects.toThrow(
        'Profile for wallet address GUNKNOWN123 not found',
      );
    });
  });

  describe('update', () => {
    it('should update existing profile', async () => {
      const dto: UpdateProfileDto = {
        displayName: 'Alice Updated',
        preferredCurrency: 'EUR',
      };
      mockCurrencyService.getSupportedCurrencies.mockReturnValue(['USD', 'EUR', 'XLM', 'USDC']);
      const result = await service.update(walletAddress, dto);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.displayName).toBe('Alice Updated');
      expect(result.preferredCurrency).toBe('EUR');
    });

    it('should create profile when not exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const dto: UpdateProfileDto = {
        displayName: 'New User',
        preferredCurrency: 'USD',
      };
      const result = await service.update(walletAddress, dto);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress,
          displayName: 'New User',
          preferredCurrency: 'USD',
          defaultSplitType: DefaultSplitType.EQUAL,
          emailNotifications: true,
          pushNotifications: true,
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unsupported currency', async () => {
      const dto: UpdateProfileDto = {
        preferredCurrency: 'XYZ',
      };
      await expect(service.update(walletAddress, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(walletAddress, dto)).rejects.toThrow(
        /not supported/,
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should accept supported currency (case insensitive)', async () => {
      const dto: UpdateProfileDto = {
        preferredCurrency: 'xlm',
      };
      const result = await service.update(walletAddress, dto);
      expect(result.preferredCurrency).toBe('XLM');
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });
});
