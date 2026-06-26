import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

// Table name is "app_user" on purpose — "user" is a reserved word in Postgres.
@Entity('app_user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 100 })
  username: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'display_name', length: 150, nullable: true })
  displayName: string;

  @Column({ length: 50, default: 'admin' })
  role: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
