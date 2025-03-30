import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { DatabaseModule } from 'src/database/database.module';
import { BcryptService } from 'src/bcrypt/bcrypt.service';
import { PasswordGeneratorService } from 'src/password-generator/password-generator/password-generator.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AccountsController],
  providers: [AccountsService, BcryptService, PasswordGeneratorService],
})
export class AccountsModule {}
