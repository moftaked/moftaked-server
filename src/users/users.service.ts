import { Injectable, NotFoundException } from '@nestjs/common';
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
    if (userTableResults.length <= 0) throw new NotFoundException();
    return userTableResults[0];
  }

  async getRoles(id: number) {
    const roles = await this.databaseService.executeQuery<Role[]>(
      'select class_id, role, school_id from roles where account_id = ?',
      [id],
    );

    return roles;
  }

  async getClasses(id: number) {
    const results = await this.databaseService.executeQuery(
      'select distinct class_id, class_name from roles inner join classes using(class_id) where account_id = ?;',
      [id],
    );

    return { results };
  }

  async getSchools(userId: number) {
    const schools = await this.databaseService.executeQuery(
      'select distinct school_id, school_name from roles inner join schools using(school_id) where account_id=?;',
      [userId],
    );
    return { schools };
  }
}
