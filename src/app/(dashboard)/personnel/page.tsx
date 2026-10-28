'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { getPersonnel, createPersonnel, updatePersonnel, deletePersonnel } from '@/actions/personnel';

const ROLE_LABELS: Record<string, string> = {
    COMPANY_ADMIN: 'Firma Admini (Tüm Yetkiler)',
    OPERATOR: 'Operatör',
    SERVICE_STAFF: 'Servis Personeli',
    TECHNICIAN: 'Teknisyen',
};

type Personnel = Awaited<ReturnType<typeof getPersonnel>>[0];

export default function PersonnelPage() {
    const { data: session } = useSession();
    const currentUserRoles = (session?.user as any)?.roles || [];
    const isCompanyAdmin = currentUserRoles.includes('COMPANY_ADMIN');

    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
    const [formError, setFormError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const load = () => { startTransition(async () => { setPersonnel(await getPersonnel()); }); };
    useEffect(() => { load(); }, []);

    const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        const fd = new FormData(e.currentTarget);
        const roles = Array.from(fd.getAll('roles')) as string[];
        if (roles.length === 0) { setFormError('En az bir rol seçin'); return; }

        if (roles.includes('COMPANY_ADMIN') && !isCompanyAdmin) {
            setFormError('Firma Admini rolü atama yetkiniz bulunmamaktadır.');
            return;
        }

        try {
            if (editingPersonnel) {
                const targetIsAdmin = editingPersonnel.roles.some((r: any) => r.role === 'COMPANY_ADMIN');
                if (targetIsAdmin && !isCompanyAdmin) {
                    setFormError('Firma Admini hesapları üzerinde sadece Firma Admini değişiklik yapabilir.');
                    return;
                }

                await updatePersonnel(editingPersonnel.id, {
                    name: fd.get('name') as string,
                    email: fd.get('email') as string,
                    password: fd.get('password') as string,
                    phone: (fd.get('phone') as string) || undefined,
                    roles,
                    isActive: fd.get('isActive') === 'on',
                });
            } else {
                await createPersonnel({
                    name: fd.get('name') as string,
                    email: fd.get('email') as string,
                    password: fd.get('password') as string,
                    phone: (fd.get('phone') as string) || undefined,
                    roles,
                });
            }
            setShowForm(false);
            setEditingPersonnel(null);
            load();
        } catch (err: any) { setFormError(err.message); }
    };

    const handleDelete = async (p: Personnel) => {
        const isTargetAdmin = p.roles.some((r: any) => r.role === 'COMPANY_ADMIN');
        if (isTargetAdmin && !isCompanyAdmin) {
            alert('Firma Admini hesapları üzerinde sadece Firma Admini işlem yapabilir.');
            return;
        }

        if (!confirm(`"${p.name}" adlı personeli silmek istediğinize emin misiniz?`)) return;
        setIsDeleting(true);
        try {
            const res = await deletePersonnel(p.id);
            alert(res.message);
            if (showForm) setShowForm(false);
            setEditingPersonnel(null);
            load();
        } catch (err: any) {
            alert('Hata: ' + (err.message || err));
        } finally {
            setIsDeleting(false);
        }
    };

    const openEditForm = (p: Personnel) => {
        const isTargetAdmin = p.roles.some((r: any) => r.role === 'COMPANY_ADMIN');
        if (isTargetAdmin && !isCompanyAdmin) {
            alert('Firma Admini hesapları üzerinde sadece Firma Admini düzenleme yapabilir.');
            return;
        }
        setEditingPersonnel(p);
        setFormError('');
        setShowForm(true);
    };

    const openCreateForm = () => {
        setEditingPersonnel(null);
        setFormError('');
        setShowForm(true);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personel Yönetimi</h1>
                    <p className="page-subtitle">{personnel.length} kişi</p>
                </div>
                <button className="btn btn-primary" onClick={openCreateForm}>➕ Yeni Personel</button>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr><th>Ad Soyad</th><th>E-posta</th><th>Telefon</th><th>Roller</th><th>Durum</th><th style={{ textAlign: 'right' }}>İşlemler</th></tr>
                    </thead>
                    <tbody>
                        {personnel.map((p) => {
                            const isTargetAdmin = p.roles.some((r: any) => r.role === 'COMPANY_ADMIN');
                            const canModify = isCompanyAdmin || !isTargetAdmin;

                            return (
                                <tr key={p.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{p.name}</span>
                                            {isTargetAdmin && (
                                                <span
                                                    style={{
                                                        fontSize: '11px',
                                                        background: 'rgba(234, 179, 8, 0.15)',
                                                        color: '#eab308',
                                                        border: '1px solid rgba(234, 179, 8, 0.3)',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    👑 Firma Admini
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{p.email}</td>
                                    <td>{p.phone || '-'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                                            {p.roles.map((r: any) => (
                                                <span key={r.id} className="badge badge-info">{ROLE_LABELS[r.role]}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`}>
                                            {p.isActive ? 'Aktif' : 'Pasif'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {canModify ? (
                                                <>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openEditForm(p)}>✏️ Düzenle</button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleDelete(p)}
                                                        style={{ color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                                        title="Personeli Sil / Pasife Al"
                                                        disabled={isDeleting}
                                                    >
                                                        🗑️ Sil
                                                    </button>
                                                </>
                                            ) : (
                                                <span
                                                    title="Firma Admini hesapları üzerinde sadece Firma Admini değişiklik yapabilir. Operatörler bu hesabı sadece görüntüleyebilir."
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '12px',
                                                        color: 'var(--text-tertiary)',
                                                        background: 'var(--bg-tertiary)',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border-primary)',
                                                        cursor: 'not-allowed',
                                                    }}
                                                >
                                                    🔒 Sadece Görüntüleme
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => !isDeleting && setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingPersonnel ? '✏️ Personel Düzenle' : '➕ Yeni Personel'}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => !isDeleting && setShowForm(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label required">Ad Soyad</label><input name="name" className="form-input" required defaultValue={editingPersonnel?.name || ''} /></div>
                                <div className="form-group"><label className="form-label required">E-posta</label><input name="email" type="email" className="form-input" required defaultValue={editingPersonnel?.email || ''} /></div>
                                <div className="form-group">
                                    <label className={editingPersonnel ? 'form-label' : 'form-label required'}>Şifre</label>
                                    <input name="password" type="password" className="form-input" required={!editingPersonnel} minLength={6} placeholder={editingPersonnel ? '(Değiştirmek için doldurun)' : ''} />
                                </div>
                                <div className="form-group"><label className="form-label">Telefon</label><input name="phone" className="form-input" defaultValue={editingPersonnel?.phone || ''} /></div>
                                <div className="form-group">
                                    <label className="form-label required">Roller</label>
                                    {Object.entries(ROLE_LABELS).map(([key, label]) => {
                                        const isRoleDisabled = key === 'COMPANY_ADMIN' && !isCompanyAdmin;
                                        return (
                                            <label
                                                key={key}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-2)',
                                                    marginBottom: 'var(--space-1)',
                                                    cursor: isRoleDisabled ? 'not-allowed' : 'pointer',
                                                    opacity: isRoleDisabled ? 0.6 : 1,
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="roles"
                                                    value={key}
                                                    className="form-checkbox"
                                                    disabled={isRoleDisabled}
                                                    defaultChecked={editingPersonnel ? editingPersonnel.roles.some((r: any) => r.role === key) : false}
                                                />
                                                <span>{label}</span>
                                                {isRoleDisabled && (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                                        (Sadece Firma Admini atayabilir)
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                                {editingPersonnel && (
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                            <input type="checkbox" name="isActive" className="form-checkbox" defaultChecked={editingPersonnel.isActive} />
                                            Aktif Personel (İşaret kaldırılırsa sisteme giriş yapamaz)
                                        </label>
                                    </div>
                                )}
                                {formError && <div style={{ padding: 'var(--space-2)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>{formError}</div>}
                            </div>
                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    {editingPersonnel && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(editingPersonnel)}
                                            style={{ color: 'var(--color-danger)' }}
                                            disabled={isDeleting}
                                        >
                                            🗑️ Personeli Sil
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={isDeleting}>İptal</button>
                                    <button type="submit" className="btn btn-primary" disabled={isDeleting}>Kaydet</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
