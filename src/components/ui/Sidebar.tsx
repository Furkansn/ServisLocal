'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const OPERATOR_LINKS = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/daily-planning', label: 'Günlük Planlama', icon: '📅' },
    { href: '/tickets', label: 'Tamir Fişleri', icon: '🔧' },
    { href: '/technician-operations', label: 'Teknisyen İşlemleri', icon: '🛠️' },
    { href: '/collections', label: 'Tahsilat & Kasa', icon: '💰' },
    { href: '/reports', label: 'Raporlar', icon: '📈' },
    { href: '/tickets/new', label: 'Yeni Fiş', icon: '➕' },
    { href: '/customers', label: 'Müşteri & Tamirci', icon: '👥' },
    { href: '/ne-takilir', label: 'Ne Takılır?', icon: '💡' },
    { href: '/price-list', label: 'Fiyat Listesi', icon: '💵' },
    { href: '/tv-display', label: 'TV Ekranı', icon: '📺' },
];

const SETTINGS_LINKS = [
    { href: '/products', label: 'Ürünler & Stok', icon: '📦' },
    { href: '/personnel', label: 'Personel', icon: '👤' },
    { href: '/template-builder', label: 'Şablon Ayarları', icon: '⚙️' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('sidebar_collapsed');
        if (stored === 'true') {
            setIsCollapsed(true);
            document.documentElement.style.setProperty('--sidebar-actual-width', '72px');
        }
    }, []);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('sidebar_collapsed', String(next));
        document.documentElement.style.setProperty('--sidebar-actual-width', next ? '72px' : '260px');
    };

    const userName = session?.user?.name || 'Kullanıcı';
    const userRoles = (session?.user as any)?.roles || [];

    const roleLabels: Record<string, string> = {
        COMPANY_ADMIN: 'Firma Admini',
        OPERATOR: 'Operatör',
        SERVICE_STAFF: 'Servis',
        TECHNICIAN: 'Teknisyen',
    };

    const roleDisplay = userRoles.map((r: string) => roleLabels[r] || r).join(', ');
    const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    const filteredLinks = OPERATOR_LINKS.filter((link) => {
        if (link.href === '/reports') {
            return userRoles.includes('COMPANY_ADMIN');
        }
        return true;
    });

    return (
        <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">🔧</div>
                <h1>ServisLocal</h1>
                <button
                    className="sidebar-toggle-btn"
                    onClick={toggleCollapse}
                    title={isCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
                >
                    {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <div className="sidebar-section-label">Ana Menü</div>
                {filteredLinks.map((link) => {
                    const isActive = link.href === '/'
                        ? pathname === '/'
                        : link.href === '/customers'
                            ? (pathname.startsWith('/customers') || pathname.startsWith('/repairers'))
                            : pathname.startsWith(link.href);

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            title={isCollapsed ? link.label : undefined}
                            className={`sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-link-icon">{link.icon}</span>
                            <span className="sidebar-link-text">{link.label}</span>
                        </Link>
                    );
                })}
                
                <div className="sidebar-section-label" style={{ marginTop: '16px' }}>Ayarlar</div>
                {SETTINGS_LINKS.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            title={isCollapsed ? link.label : undefined}
                            className={`sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-link-icon">{link.icon}</span>
                            <span className="sidebar-link-text">{link.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User */}
            <div className="sidebar-user">
                <div className="sidebar-user-avatar">{initials}</div>
                <div className="sidebar-user-info">
                    <div className="sidebar-user-name">{userName}</div>
                    <div className="sidebar-user-role">{roleDisplay}</div>
                </div>
                <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    title="Çıkış Yap"
                    style={{ fontSize: '16px' }}
                >
                    🚪
                </button>
            </div>
        </aside>
    );
}

