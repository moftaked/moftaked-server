import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from 'src/database/database.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findOne(username: string) {
    const userTableResults = await this.databaseService.executeQuery<User[]>(
      'select account_id, username, password, real_name from accounts where username = ?',
      [username],
    );

    return userTableResults[0];
  }

  async getRoles(id: string) {
    const roles = await this.databaseService.executeQuery<Role[]>(
      'select class_id, role from roles where account_id = ?',
      [id],
    );

    return roles;
  }

  async getClasses(id: string) {
    const classes = await this.databaseService.executeQuery(
      'select class_id, class_name from roles inner join classes using(class_id) where account_id = ?;',
      [id]
    );

    return classes;
  }
}
