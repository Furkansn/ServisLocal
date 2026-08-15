import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'servislocal-secret-prod-2026',
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Şifre', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const personnel = await prisma.personnel.findUnique({
                    where: { email: credentials.email as string },
                    include: {
                        roles: true,
                    },
                });

                if (!personnel || !personnel.isActive) return null;

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    personnel.passwordHash
                );

                if (!isValid) return null;

                return {
                    id: personnel.id,
                    name: personnel.name,
                    email: personnel.email,
                    roles: personnel.roles.map((r) => r.role),
                };
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.roles = (user as any).roles;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as any).roles = token.roles;
            }
            return session;
        },
    },
    session: {
        strategy: 'jwt',
    },
});
