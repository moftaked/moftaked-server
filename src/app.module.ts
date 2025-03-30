import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { StudentsModule } from './students/students.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BcryptModule } from './bcrypt/bcrypt.module';
import { ClassesModule } from './classes/classes.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { EventsModule } from './events/events.module';
import { TeachersModule } from './teachers/teachers.module';
import { SchoolsModule } from './schools/schools.module';
import { AccountsModule } from './accounts/accounts.module';
import { PasswordGeneratorService } from './password-generator/password-generator/password-generator.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client/browser'),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),
    StudentsModule,
    AuthModule,
    UsersModule,
    BcryptModule,
    ClassesModule,
    EventsModule,
    TeachersModule,
    SchoolsModule,
    AccountsModule,
  ],
  providers: [AppService, PasswordGeneratorService],
})
export class AppModule {}
