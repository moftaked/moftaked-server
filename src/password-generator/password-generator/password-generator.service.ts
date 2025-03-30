import { Injectable } from '@nestjs/common';
import { generate } from 'generate-password';

@Injectable()
export class PasswordGeneratorService {
  generate() {
    return new Promise<string>((resolve) => {
      const password = generate({
        length: 8,
        numbers: true,
        uppercase: true,
        lowercase: true,
      });
      resolve(password);
    });
  }
}
