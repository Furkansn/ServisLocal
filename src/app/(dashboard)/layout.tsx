import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/components/ui/Sidebar';
import Navbar from '@/components/ui/Navbar';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SessionProvider>
            <div className="app-layout">
                <Sidebar />
                <main className="app-main">
                    <Navbar />
                    <div className="app-content">
                        {children}
                    </div>
                </main>
            </div>
        </SessionProvider>
    );
}
