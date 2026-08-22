import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marca un handler/controller como accesible sin JWT. El JwtAuthGuard global
// (ver guards/jwt-auth.guard.ts) lee esta metadata con Reflector y deja pasar.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
