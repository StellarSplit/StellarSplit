import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  ValidationPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { ProfileService } from './profile.service';
import { UserProfile } from './profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilePolicyGuard } from './profile-policy.guard';
// import { Public } from '../auth/decorators/public.decorator'; // Uncomment if your project has this decorator

interface AuthRequest {
  user: {
    walletAddress: string;
    id: string;
  };
}

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':walletAddress')
  @ApiOperation({ summary: 'Get user profile by wallet address' })
  @ApiParam({
    name: 'walletAddress',
    description: 'Stellar wallet address (G...)',
    example:
      'GDZST3XVCDTUJ76ZAV2HA72KYQODXXZ5PTMAPZGDHZ6CS7RO7MGG3DBM',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile found',
    type: UserProfile,
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found for wallet address',
  })
  async getByWalletAddress(
    @Param('walletAddress') walletAddress: string,
  ): Promise<UserProfile> {
    return this.profileService.getByWalletAddress(walletAddress);
  }

  // Use @Public() if your project supports it
  // @Public()
  @Get('public/:walletAddress')
  @ApiOperation({ summary: 'Get public profile' })
  @ApiParam({
    name: 'walletAddress',
    description: 'Stellar wallet address (G...)',
  })
  @ApiResponse({
    status: 200,
    description: 'Public profile retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found',
  })
  async getPublicProfile(
    @Param('walletAddress') walletAddress: string,
  ) {
    return this.profileService.getPublicProfile(walletAddress);
  }

  @Patch(':walletAddress')
  @UseGuards(JwtAuthGuard, ProfilePolicyGuard)
  @ApiOperation({ summary: 'Update user profile (creates if not exists)' })
  @ApiParam({
    name: 'walletAddress',
    description: 'Stellar wallet address (G...)',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    type: UserProfile,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async update(
    @Param('walletAddress') walletAddress: string,
    @Body(ValidationPipe) dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.profileService.update(walletAddress, dto);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Unsupported file type or file too large',
  })
  async uploadAvatar(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    return this.profileService.uploadAvatar(
      req.user.walletAddress,
      file,
    );
  }
}