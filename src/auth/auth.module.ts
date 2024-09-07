import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BcryptModule } from 'src/bcrypt/bcrypt.module';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';

const jwtSecretFactory = (configService: ConfigService) => {
  return configService.get<string>('JWT_SECRET');
};

@Module({
  imports: [
    BcryptModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '60m' }, // Example expiration time
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthGuard,
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
