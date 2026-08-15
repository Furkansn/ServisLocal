import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const isLoggedIn = !!req.auth;
    const userRoles = (req.auth?.user as any)?.roles || [];

    // Public routes
    const publicRoutes = ['/login'];
    if (publicRoutes.includes(pathname)) {
        if (isLoggedIn) {
            // Redirect to appropriate dashboard based on role
            if (userRoles.includes('OPERATOR')) {
                return NextResponse.redirect(new URL('/', req.url));
            }
            if (userRoles.includes('SERVICE_STAFF')) {
                return NextResponse.redirect(new URL('/service', req.url));
            }
            if (userRoles.includes('TECHNICIAN')) {
                return NextResponse.redirect(new URL('/technician', req.url));
            }
            return NextResponse.redirect(new URL('/', req.url));
        }
        return NextResponse.next();
    }

    // Protected routes - require authentication
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Redirect non-operator from dashboard root to their panel
    if (pathname === '/') {
        if (!userRoles.includes('OPERATOR')) {
            if (userRoles.includes('TECHNICIAN')) {
                return NextResponse.redirect(new URL('/technician', req.url));
            }
            if (userRoles.includes('SERVICE_STAFF')) {
                return NextResponse.redirect(new URL('/service', req.url));
            }
        }
    }

    // Role-based route protection
    // Operator routes
    const operatorRoutes = ['/tickets', '/customers', '/repairers', '/personnel', '/daily-planning', '/products', '/tv-display'];
    if (operatorRoutes.some((r) => pathname.startsWith(r))) {
        if (!userRoles.includes('OPERATOR')) {
            if (userRoles.includes('TECHNICIAN')) {
                return NextResponse.redirect(new URL('/technician', req.url));
            }
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    // Service staff routes
    if (pathname.startsWith('/service')) {
        if (!userRoles.includes('SERVICE_STAFF')) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    // Technician routes
    if (pathname.startsWith('/technician')) {
        if (!userRoles.includes('TECHNICIAN')) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|fonts|manifest.json|sw.js|workbox-.*).*)'],
};
