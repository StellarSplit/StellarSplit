import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, NotFoundException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UserProfile, DefaultSplitType } from './profile.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilePolicyGuard } from './profile-policy.guard';

const allowAllGuard: CanActivate = { canActivate: () => true };

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: ProfileService;

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

  const mockProfileService = {
    getByWalletAddress: jest.fn().mockResolvedValue(mockProfile),
    update: jest.fn().mockResolvedValue(mockProfile),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProfileService.getByWalletAddress.mockResolvedValue(mockProfile);
    mockProfileService.update.mockResolvedValue(mockProfile);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: mockProfileService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(ProfilePolicyGuard)
      .useValue(allowAllGuard)
      .compile();

    controller = module.get<ProfileController>(ProfileController);
    profileService = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getByWalletAddress', () => {
    it('should return profile for wallet address', async () => {
      const result = await controller.getByWalletAddress(walletAddress);
      expect(result).toEqual(mockProfile);
      expect(profileService.getByWalletAddress).toHaveBeenCalledWith(walletAddress);
    });

    it('should throw when service throws NotFoundException', async () => {
      mockProfileService.getByWalletAddress.mockRejectedValue(
        new NotFoundException('Profile for wallet address GUNKNOWN not found'),
      );
      await expect(
        controller.getByWalletAddress('GUNKNOWN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return profile', async () => {
      const dto = {
        displayName: 'Alice Updated',
        preferredCurrency: 'EUR' as const,
      };
      const result = await controller.update(walletAddress, dto);
      expect(result).toEqual(mockProfile);
      expect(profileService.update).toHaveBeenCalledWith(walletAddress, dto);
    });
  });
});
