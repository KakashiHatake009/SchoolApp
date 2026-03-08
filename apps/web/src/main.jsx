import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import keycloak from './keycloak.js';

// Init Keycloak with check-sso — doesn't force login on page load.
// Admin routes trigger login themselves via ProtectedRoute.
keycloak
    .init({ onLoad: 'check-sso', pkceMethod: 'S256' })
    .then(() => {
        ReactDOM.createRoot(document.getElementById('root')).render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    })
    .catch((err) => {
        console.error('Keycloak init failed', err);
        // Render app anyway so public/parent pages still work
        ReactDOM.createRoot(document.getElementById('root')).render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    });
