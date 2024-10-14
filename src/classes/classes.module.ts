import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { DatabaseModule } from 'src/database/database.module';
import { EventsModule } from 'src/events/events.module';
import { EventsService } from 'src/events/events.service';

@Module({
  imports: [DatabaseModule, EventsModule],
  controllers: [ClassesController],
  providers: [ClassesService, EventsService],
})
export class ClassesModule {}
