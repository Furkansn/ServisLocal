import { redirect } from 'next/navigation';

export default function RepairersPage() {
    redirect('/customers?tab=repairers');
}
