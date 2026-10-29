import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const isLoggedIn = !!req.auth;
    const userRoles = (req.auth?.user as any)?.roles || [];
    const isCompanyAdmin = userRoles.includes('COMPANY_ADMIN');
    const isOperator = userRoles.includes('OPERATOR') || isCompanyAdmin;

    // Public routes
    if (pathname === '/login') {
        if (isLoggedIn) {
            // Redirect to appropriate dashboard based on role
            if (isOperator) {
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

    if (pathname.startsWith('/print/')) {
        return NextResponse.next();
    }

    // Protected routes - require authentication
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Reports route: EXCLUSIVELY for COMPANY_ADMIN
    if (pathname.startsWith('/reports')) {
        if (!isCompanyAdmin) {
            return NextResponse.redirect(new URL('/', req.url));
        }
    }

    // Redirect non-operator from dashboard root to their panel
    if (pathname === '/') {
        if (!isOperator) {
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
    const operatorRoutes = ['/tickets', '/customers', '/repairers', '/collections', '/personnel', '/daily-planning', '/products', '/tv-display', '/price-list', '/template-builder', '/technician-operations', '/ne-takilir'];
    if (operatorRoutes.some((r) => pathname.startsWith(r))) {
        if (!isOperator) {
            if (userRoles.includes('TECHNICIAN')) {
                return NextResponse.redirect(new URL('/technician', req.url));
            }
            if (userRoles.includes('SERVICE_STAFF')) {
                return NextResponse.redirect(new URL('/service', req.url));
            }
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    // Service staff routes
    if (pathname === '/service' || pathname.startsWith('/service/')) {
        if (!userRoles.includes('SERVICE_STAFF') && !isCompanyAdmin) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    // Technician routes
    if (pathname === '/technician' || pathname.startsWith('/technician/')) {
        if (!userRoles.includes('TECHNICIAN') && !isCompanyAdmin) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|fonts|manifest.json|sw.js|workbox-.*).*)'],
};
