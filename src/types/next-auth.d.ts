import { Role } from '@prisma/client';

// Extend NextAuth types
declare module 'next-auth' {
    interface User {
        id: string;
        roles: Role[];
    }

    interface Session {
        user: {
            id: string;
            name: string;
            email: string;
            roles: Role[];
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        roles: Role[];
    }
}
