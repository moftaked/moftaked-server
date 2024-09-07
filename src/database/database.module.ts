import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool } from 'mysql2/promise';
import { DatabaseService } from './database.service';

const databasePoolFactory = async (configService: ConfigService) => {
  const pool = createPool({
    host: configService.get('DATABASE_HOST'),
    user: configService.get('DATABASE_USER'),
    database: configService.get('DATABASE_NAME'),
    password: configService.get('DATABASE_PASSWORD'),
    port: configService.get('DATABASE_PORT'),
  });

  return pool;
};

@Module({
  providers: [
    {
      provide: 'DATABASE_POOL',
      inject: [ConfigService],
      useFactory: databasePoolFactory,
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
