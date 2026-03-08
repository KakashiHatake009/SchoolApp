import { useState, useEffect } from 'react';
import { adminApi, isPlatformAdmin } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

const EMPTY_FORM = { name: '', email: '', subject: '', schoolId: '' };

export default function TeachersPage() {
    const isAdmin = isPlatformAdmin();
    const [teachers, setTeachers] = useState([]);
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [tempPassword, setTempPassword] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        load();
        if (isAdmin) adminApi.getSchools().then(setSchools).catch(() => {});
    }, []);

    async function load() {
        try {
            setTeachers(await adminApi.getTeachers());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function set(field) {
        return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
    }

    async function handleCreate(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setTempPassword(null);
        try {
            const result = await adminApi.createTeacher(form);
            setTempPassword({ name: form.name, password: result.tempPassword });
            setForm(EMPTY_FORM);
            setShowForm(false);
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id, name) {
        if (!window.confirm(`Deactivate ${name}?`)) return;
        try {
            await adminApi.deleteTeacher(id);
            setTeachers((ts) => ts.filter((t) => t.id !== id));
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Teachers</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setTempPassword(null); }}>
                    {showForm ? '✕ Cancel' : '+ New Teacher'}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {tempPassword && (
                <div className="temp-pw-box">
                    <p>✅ <strong>{tempPassword.name}</strong> has been added. Share this temporary password:</p>
                    <code>{tempPassword.password}</code>
                    <p style={{ marginTop: 6 }}>They will be asked to change it on first login.</p>
                </div>
            )}

            {showForm && (
                <div className="inline-form">
                    <div className="card-title">New Teacher</div>
                    <form onSubmit={handleCreate}>
                        {isAdmin && (
                            <div className="form-group">
                                <label className="form-label">School *</label>
                                <select className="form-select" required value={form.schoolId} onChange={set('schoolId')}>
                                    <option value="">— Select a school —</option>
                                    {schools.filter((s) => s.isActive).map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Full name *</label>
                                <input className="form-input" required value={form.name} onChange={set('name')} placeholder="Jane Smith" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email *</label>
                                <input className="form-input" type="email" required value={form.email} onChange={set('email')} placeholder="jane@school.edu" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Subject</label>
                            <input className="form-input" value={form.subject} onChange={set('subject')} placeholder="Mathematics" />
                        </div>
                        <div className="form-actions">
                            <button className="btn btn-primary" type="submit" disabled={saving}>
                                {saving ? 'Creating…' : 'Create teacher'}
                            </button>
                            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? <Spinner /> : teachers.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon">👩‍🏫</div>
                        <p>No teachers yet. Add your first teacher above.</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th></th></tr>
                            </thead>
                            <tbody>
                                {teachers.map((t) => (
                                    <tr key={t.id}>
                                        <td style={{ fontWeight: 500 }}>{t.name}</td>
                                        <td>{t.email}</td>
                                        <td>{t.subject || '—'}</td>
                                        <td>
                                            <span className={`badge ${t.isActive ? 'badge-green' : 'badge-red'}`}>
                                                {t.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            {t.isActive && (
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.name)}>
                                                    Deactivate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
