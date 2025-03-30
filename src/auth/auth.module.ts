import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BcryptModule } from 'src/bcrypt/bcrypt.module';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from '../guards/auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

const jwtSecretFactory = (configService: ConfigService) => {
  return configService.get<string>('JWT_SECRET');
};

@Module({
  imports: [
    BcryptModule,
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    ThrottlerGuard,
    AuthService,
    {
      provide: 'JWT_SECRET',
      inject: [ConfigService],
      useFactory: jwtSecretFactory,
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {
  constructor(private readonly authService: AuthService) {}
}
