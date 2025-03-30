import { Test, TestingModule } from '@nestjs/testing';
import { PasswordGeneratorService } from './password-generator.service';

describe('PasswordGeneratorService', () => {
  let service: PasswordGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordGeneratorService],
    }).compile();

    service = module.get<PasswordGeneratorService>(PasswordGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
