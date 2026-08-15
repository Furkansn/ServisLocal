'use client';

import { SessionProvider, useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <div className="mobile-layout">
                <MobileHeaderNav title="ServisLocal Saha" icon="🚐" />
                <main className="mobile-content">{children}</main>
                <MobileBottomNav />
            </div>
        </SessionProvider>
    );
}

function MobileHeaderNav({ title, icon }: { title: string; icon: string }) {
    const { data: session } = useSession();
    const userRoles: string[] = (session?.user as any)?.roles || [];
    const pathname = usePathname();

    const hasService = userRoles.includes('SERVICE_STAFF');
    const hasTechnician = userRoles.includes('TECHNICIAN');
    const hasOperator = userRoles.includes('OPERATOR');

    return (
        <header className="mobile-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{icon}</span>
                <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{title}</h1>
            </div>

            {/* Role Switcher Pills if user has multiple roles */}
            {((hasService && hasTechnician) || hasOperator) && (
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '20px', border: '1px solid var(--border-color)', gap: '2px' }}>
                    <Link
                        href="/service"
                        className={`btn btn-xs ${pathname.startsWith('/service') ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ borderRadius: '16px', fontSize: '11px', padding: '3px 8px' }}
                    >
                        🚚 Saha
                    </Link>
                    <Link
                        href="/technician"
                        className={`btn btn-xs ${pathname.startsWith('/technician') ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ borderRadius: '16px', fontSize: '11px', padding: '3px 8px' }}
                    >
                        🔧 Atölye
                    </Link>
                    {hasOperator && (
                        <Link
                            href="/"
                            className="btn btn-ghost btn-xs"
                            style={{ borderRadius: '16px', fontSize: '11px', padding: '3px 8px' }}
                        >
                            📊 Panel
                        </Link>
                    )}
                </div>
            )}

            <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => signOut({ callbackUrl: '/login' })} title="Çıkış Yap">🚪</button>
        </header>
    );
}

function MobileBottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const userRoles: string[] = (session?.user as any)?.roles || [];

    const links = [
        { href: '/service', label: 'İşlerim', icon: '📋' },
        { href: '/service/map', label: 'Harita', icon: '🗺' },
    ];

    if (userRoles.includes('TECHNICIAN')) {
        links.push({ href: '/technician', label: 'Atölye', icon: '🔧' });
    }

    return (
        <nav className="mobile-bottom-nav">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className={`mobile-nav-item ${pathname === link.href ? 'active' : ''}`}
                >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                </Link>
            ))}
        </nav>
    );
}
