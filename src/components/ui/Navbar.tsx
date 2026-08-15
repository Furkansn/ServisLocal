'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
    const pathname = usePathname();
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            setTheme('light');
        }
    }, []);

    const toggleTheme = () => {
        if (theme === 'light') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
            setTheme('dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            setTheme('light');
        }
    };

    const getPageTitle = () => {
        const routes: Record<string, string> = {
            '/': 'Dashboard',
            '/daily-planning': 'Günlük Planlama',
            '/tickets': 'Tamir Fişleri',
            '/tickets/new': 'Yeni Tamir Fişi',
            '/customers': 'Müşteriler',
            '/repairers': 'Tamirciler',
            '/products': 'Ürünler & Stok',
            '/personnel': 'Personel Yönetimi',
            '/tv-display': '📺 Cihaz Takip TV',
        };
        // Handle dynamic routes crudely if needed, but pathname usually suffices for exact matches
        // For /tickets/[id], pathname is the full path. We can check startsWith.
        if (pathname.startsWith('/tickets/') && pathname !== '/tickets/new') return 'Fiş Detayı';
        if (pathname.endsWith('/edit')) return 'Fiş Düzenle';

        return routes[pathname] || 'ServisPlus';
    };

    return (
        <header className="app-navbar">
            <h2 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 700,
                color: 'var(--text-primary)',
            }}>
                {getPageTitle()}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: 'auto' }}>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={toggleTheme}
                    title={theme === 'light' ? 'Koyu Mod' : 'Aydınlık Mod'}
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => window.location.reload()}
                    title="Yenile"
                >
                    🔄
                </button>
            </div>
        </header>
    );
}
