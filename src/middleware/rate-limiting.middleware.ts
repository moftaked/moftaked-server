import rateLimit from 'express-rate-limit';

const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
};

export const loginRateLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many login attempts, please try again after a minute' },
});

export const accountCreationRateLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many account creation attempts, please try again after 15 minutes' },
});

export const photoUploadRateLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many photo upload attempts, please try again after a minute' },
});

export const sensitiveOperationRateLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many requests, please try again after a minute' },
});

export const generalApiRateLimiter = rateLimit({
  ...defaults,
  windowMs: 1 * 60 * 1000,
  limit: 100,
  message: { error: 'Too many requests, please try again after a minute' },
});

export const rateLimiter = loginRateLimiter;
