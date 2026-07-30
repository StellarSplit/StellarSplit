import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DefaultSplitType {
  EQUAL = 'equal',
  ITEMIZED = 'itemized',
  PERCENTAGE = 'percentage',
  CUSTOM = 'custom',
}

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn({ type: 'varchar', length: 56, name: 'wallet_address' })
  walletAddress!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'display_name' })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email' })
  email!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'avatar_thumb_url' })
  avatarThumbUrl!: string | null;

  @Column({ type: 'text', nullable: true, name: 'bio' })
  bio!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'USD', name: 'preferred_currency' })
  preferredCurrency!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: DefaultSplitType.EQUAL,
    name: 'default_split_type',
  })
  defaultSplitType!: DefaultSplitType;

  @Column({ type: 'boolean', default: true, name: 'email_notifications' })
  emailNotifications!: boolean;

  @Column({ type: 'boolean', default: true, name: 'push_notifications' })
  pushNotifications!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
