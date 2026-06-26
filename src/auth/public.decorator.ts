import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Mark a route handler (or whole controller) as reachable without a JWT.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
