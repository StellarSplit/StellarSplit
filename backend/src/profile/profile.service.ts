import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import sharp from 'sharp';

import { UserProfile, DefaultSplitType } from './profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrencyService } from '../modules/currency/currency.service';
import { UploadService } from '../uploads/upload.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    private readonly currencyService: CurrencyService,
    private readonly uploadService: UploadService,
  ) {}

  async getByWalletAddress(walletAddress: string): Promise<UserProfile> {
    const profile = await this.profileRepository.findOne({
      where: { walletAddress },
    });

    if (!profile) {
      throw new NotFoundException(
        `Profile for wallet address ${walletAddress} not found`,
      );
    }

    return profile;
  }

  async getPublicProfile(walletAddress: string) {
    const profile = await this.profileRepository.findOne({
      where: { walletAddress },
    });

    if (!profile) {
      throw new NotFoundException(
        `Profile for wallet address ${walletAddress} not found`,
      );
    }

    return {
      walletAddress: profile.walletAddress,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarThumbUrl: profile.avatarThumbUrl,
      bio: profile.bio,
    };
  }

  async uploadAvatar(
    walletAddress: string,
    file: Express.Multer.File,
  ) {
    const profile = await this.profileRepository.findOne({
      where: { walletAddress },
    });

    if (!profile) {
      throw new NotFoundException(
        `Profile for wallet address ${walletAddress} not found`,
      );
    }

    const thumbBuffer = await sharp(file.buffer)
      .resize(128, 128, {
        fit: 'cover',
      })
      .webp({
        quality: 80,
      })
      .toBuffer();

    const fullBuffer = await sharp(file.buffer)
      .resize(400, 400, {
        fit: 'cover',
      })
      .webp({
        quality: 90,
      })
      .toBuffer();

    const avatarThumbUrl = await this.uploadService.uploadBuffer(
      thumbBuffer,
      `${walletAddress}-thumb.webp`,
      'image/webp',
    );

    const avatarUrl = await this.uploadService.uploadBuffer(
      fullBuffer,
      `${walletAddress}.webp`,
      'image/webp',
    );

    profile.avatarUrl = avatarUrl;
    profile.avatarThumbUrl = avatarThumbUrl;

    await this.profileRepository.save(profile);

    return {
      avatarUrl,
      avatarThumbUrl,
    };
  }

  async update(
    walletAddress: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    let preferredCurrency: string | undefined;

    if (dto.preferredCurrency !== undefined) {
      const supported = this.currencyService.getSupportedCurrencies();

      const normalized = dto.preferredCurrency
        .toUpperCase()
        .trim();

      if (!supported.includes(normalized)) {
        throw new BadRequestException(
          `Currency "${dto.preferredCurrency}" is not supported. Supported: ${supported.join(', ')}`,
        );
      }

      preferredCurrency = normalized;
    }

    let profile = await this.profileRepository.findOne({
      where: { walletAddress },
    });

    if (!profile) {
      profile = this.profileRepository.create({
        walletAddress,
        displayName: dto.displayName ?? null,
        avatarUrl: null,
        avatarThumbUrl: null,
        preferredCurrency: preferredCurrency ?? 'USD',
        defaultSplitType:
          dto.defaultSplitType ?? DefaultSplitType.EQUAL,
        emailNotifications:
          dto.emailNotifications ?? true,
        pushNotifications:
          dto.pushNotifications ?? true,
      });
    } else {
      Object.assign(profile, {
        ...dto,
        ...(preferredCurrency !== undefined && {
          preferredCurrency,
        }),
      });
    }

    return await this.profileRepository.save(profile);
  }
}