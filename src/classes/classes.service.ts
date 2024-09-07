import { Injectable } from '@nestjs/common';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ClassesService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createClassDto: CreateClassDto) {
    return 'This action adds a new class';
  }

  async findAll() {
    const classes = await this.databaseService.executeQuery(
      'select class_id, class_name from classes;',
    );
    return classes;
  }

  async findOne(id: number) {
    const result = await this.databaseService.executeQuery(
      'select class_id, class_name from classes where id = ?;',
      [id],
    );
    return result;
  }

  async getStudents(id: number) {
    const students = await this.databaseService.executeQuery(
      'select student_id, student_name, address, photo_link, google_maps_home_link, phone_number from students inner join student_class using(student_id) inner join phone_numbers using(student_id) where class_id = ?;',
      [id],
    );
    return students;
  }

  update(id: number, updateClassDto: UpdateClassDto) {
    return `This action updates a #${id} class`;
  }

  remove(id: number) {
    return `This action removes a #${id} class`;
  }
}
