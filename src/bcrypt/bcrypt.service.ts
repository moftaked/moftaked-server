import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptService {
  async hash(password: string) {
    const hash = await bcrypt.hash(password, 10);
    return hash;
  }

  async compare(password: string, hashed: string) {
    const res = await bcrypt.compare(password, hashed);
    return res;
  }
}
