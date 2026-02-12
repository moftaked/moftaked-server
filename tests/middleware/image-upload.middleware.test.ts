import { describe, it, expect } from '@jest/globals';
import {
  upload,
  processAndSaveImage,
  sizedFilename,
  IMAGE_SIZES,
} from '../../src/middleware/image-upload.middleware';
import type { SizeKey } from '../../src/middleware/image-upload.middleware';

describe('Image Upload Middleware', () => {
  describe('upload (multer) configuration', () => {
    it('should be a valid multer instance with single/array/fields methods', () => {
      expect(typeof upload.single).toBe('function');
      expect(typeof upload.array).toBe('function');
      expect(typeof upload.fields).toBe('function');
    });

    it('should have file size limit of 10MB (10 * 1024 * 1024)', () => {
      const limits = (upload as any).limits;
      expect(limits).toBeDefined();
      expect(limits.fileSize).toBe(1024 * 1024 * 10);
    });
  });

  describe('IMAGE_SIZES', () => {
    it('should define sm size as 64', () => {
      expect(IMAGE_SIZES.sm).toBe(64);
    });

    it('should define md size as 256', () => {
      expect(IMAGE_SIZES.md).toBe(256);
    });

    it('should define lg size as 800', () => {
      expect(IMAGE_SIZES.lg).toBe(800);
    });

    it('should have exactly 3 size variants', () => {
      expect(Object.keys(IMAGE_SIZES)).toHaveLength(3);
    });

    it('should contain keys sm, md, lg', () => {
      expect(Object.keys(IMAGE_SIZES).sort()).toEqual(['lg', 'md', 'sm']);
    });
  });

  describe('sizedFilename', () => {
    it('should generate correct filename for sm size', () => {
      const result = sizedFilename('photo-1234567890-123456789', 'sm');
      expect(result).toBe('photo-1234567890-123456789-sm.webp');
    });

    it('should generate correct filename for md size', () => {
      const result = sizedFilename('photo-1234567890-123456789', 'md');
      expect(result).toBe('photo-1234567890-123456789-md.webp');
    });

    it('should generate correct filename for lg size', () => {
      const result = sizedFilename('photo-1234567890-123456789', 'lg');
      expect(result).toBe('photo-1234567890-123456789-lg.webp');
    });

    it('should always use .webp extension', () => {
      const sizes: SizeKey[] = ['sm', 'md', 'lg'];
      for (const size of sizes) {
        const result = sizedFilename('test-base', size);
        expect(result).toMatch(/\.webp$/);
      }
    });

    it('should include the size suffix before the extension', () => {
      const result = sizedFilename('myfile', 'md');
      expect(result).toBe('myfile-md.webp');
    });

    it('should handle base filenames with multiple dashes', () => {
      const result = sizedFilename('photo-field-1234567890-987654321', 'lg');
      expect(result).toBe('photo-field-1234567890-987654321-lg.webp');
    });
  });

  describe('processAndSaveImage', () => {
    it('should be a function', () => {
      expect(typeof processAndSaveImage).toBe('function');
    });
  });
});