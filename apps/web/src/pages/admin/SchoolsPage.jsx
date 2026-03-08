import { useState, useEffect } from 'react';
import { adminApi, isPlatformAdmin } from '../../api.js';
import { useNavigate } from 'react-router-dom';
import Spinner from '../../components/Spinner.jsx';

const PLANS = ['FREE', 'BASIC', 'PRO'];

const EMPTY_FORM = {
    name: '', address: '', contactEmail: '', subscriptionPlan: 'FREE',
};

export default function SchoolsPage() {
    const navigate = useNavigate();
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Guard — only platform admins should reach this page
    useEffect(() => {
        if (!isPlatformAdmin()) { navigate('/admin/events'); return; }
        load();
    }, []);

    async function load() {
        try {
            setSchools(await adminApi.getSchools());
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
        try {
            await adminApi.createSchool(form);
            setShowForm(false);
            setForm(EMPTY_FORM);
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeactivate(id, name) {
        if (!window.confirm(`Deactivate "${name}"? This hides it from school admins.`)) return;
        try {
            await adminApi.deleteSchool(id);
            setSchools((s) => s.map((sc) => sc.id === id ? { ...sc, isActive: false } : sc));
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleReactivate(id) {
        try {
            await adminApi.updateSchool(id, { isActive: true });
            setSchools((s) => s.map((sc) => sc.id === id ? { ...sc, isActive: true } : sc));
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Schools</h1>
                <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
                    {showForm ? '✕ Cancel' : '+ New School'}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {showForm && (
                <div className="inline-form">
                    <div className="card-title">New School</div>
                    <form onSubmit={handleCreate}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">School name *</label>
                                <input className="form-input" required value={form.name} onChange={set('name')} placeholder="Riverside Primary" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contact email *</label>
                                <input className="form-input" type="email" required value={form.contactEmail} onChange={set('contactEmail')} placeholder="admin@school.edu" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input className="form-input" value={form.address} onChange={set('address')} placeholder="123 Main St" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subscription plan</label>
                                <select className="form-select" value={form.subscriptionPlan} onChange={set('subscriptionPlan')}>
                                    {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button className="btn btn-primary" type="submit" disabled={saving}>
                                {saving ? 'Creating…' : 'Create school'}
                            </button>
                            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? <Spinner /> : schools.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon">🏫</div>
                        <p>No schools yet. Create the first one above.</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>School</th>
                                    <th>Contact</th>
                                    <th>Plan</th>
                                    <th>Status</th>
                                    <th>ID</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {schools.map((sc) => (
                                    <tr key={sc.id}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{sc.name}</div>
                                            {sc.address && <div style={{ fontSize: 12, color: '#9ca3af' }}>{sc.address}</div>}
                                        </td>
                                        <td>{sc.contactEmail}</td>
                                        <td>
                                            <span className={`badge ${sc.subscriptionPlan === 'FREE' ? 'badge-gray' : sc.subscriptionPlan === 'PRO' ? 'badge-blue' : 'badge-orange'}`}>
                                                {sc.subscriptionPlan}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${sc.isActive ? 'badge-green' : 'badge-red'}`}>
                                                {sc.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                                            {sc.id.slice(0, 12)}…
                                        </td>
                                        <td>
                                            {sc.isActive ? (
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(sc.id, sc.name)}>
                                                    Deactivate
                                                </button>
                                            ) : (
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleReactivate(sc.id)}>
                                                    Reactivate
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
