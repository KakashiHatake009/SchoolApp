import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

function formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BookEmail() {
    const { qrToken } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        publicApi.getEventByQr(qrToken)
            .then(setEvent)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [qrToken]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSending(true);
        try {
            await publicApi.sendOtp({ email, eventId: event.id });
            navigate(`/book/${qrToken}/verify`, { state: { email, eventId: event.id, eventTitle: event.title } });
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    if (loading) return (
        <div className="parent-page"><div className="parent-card"><Spinner /></div></div>
    );

    if (!event && error) return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="parent-logo">❌</div>
                <h1>Event Not Found</h1>
                <p className="subtitle">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="parent-logo">🏫</div>
                <h1>Book Your Slot</h1>
                <p className="subtitle">Enter your email to receive a verification code</p>

                {event && (
                    <div className="event-info">
                        <div className="event-title">{event.title}</div>
                        <div className="event-meta">
                            📅 {formatDate(event.startDate)}
                            {event.location && <> &bull; 📍 {event.location}</>}
                        </div>
                    </div>
                )}

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Your email address</label>
                        <input
                            className="form-input"
                            type="email"
                            required
                            placeholder="parent@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={sending}>
                        {sending ? 'Sending code…' : 'Send verification code →'}
                    </button>
                </form>
            </div>
        </div>
    );
}
