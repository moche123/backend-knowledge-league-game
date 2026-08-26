import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marks a handler/controller as accessible without a JWT. The global JwtAuthGuard
// (see guards/jwt-auth.guard.ts) reads this metadata via Reflector and lets it through.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
