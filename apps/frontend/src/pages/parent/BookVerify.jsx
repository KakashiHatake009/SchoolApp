import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { publicApi } from '../../api.js';

export default function BookVerify() {
    const { qrToken } = useParams();
    const navigate = useNavigate();
    const { state } = useLocation();

    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    // If arrived without state (e.g. direct URL), go back to start
    useEffect(() => {
        if (!state?.email) navigate(`/book/${qrToken}`, { replace: true });
    }, []);

    // Resend cooldown countdown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    async function handleVerify(e) {
        e.preventDefault();
        setError('');
        setVerifying(true);
        try {
            const { token } = await publicApi.verifyOtp({
                email: state.email,
                eventId: state.eventId,
                code,
            });
            // Store parent JWT for the next steps
            sessionStorage.setItem('parentToken', token);
            navigate(`/book/${qrToken}/slots`, {
                state: { email: state.email, eventId: state.eventId, eventTitle: state.eventTitle },
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setVerifying(false);
        }
    }

    async function handleResend() {
        setError('');
        try {
            await publicApi.sendOtp({ email: state.email, eventId: state.eventId });
            setResendCooldown(60);
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="parent-logo">✉️</div>
                <h1>Check Your Email</h1>
                <p className="subtitle">
                    We sent a 6-digit code to <strong>{state?.email}</strong>
                </p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleVerify}>
                    <div className="form-group">
                        <label className="form-label">Verification code</label>
                        <input
                            className="form-input otp-input"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            placeholder="000000"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={verifying || code.length !== 6}>
                        {verifying ? 'Verifying…' : 'Verify code →'}
                    </button>
                </form>

                <div className="resend-row">
                    Didn't get it?{' '}
                    {resendCooldown > 0 ? (
                        <span>Resend in {resendCooldown}s</span>
                    ) : (
                        <button onClick={handleResend}>Resend code</button>
                    )}
                </div>
            </div>
        </div>
    );
}
