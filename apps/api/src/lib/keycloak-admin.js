/**
 * Minimal Keycloak Admin API helper.
 * Used by the teachers controller to create/delete Keycloak users
 * when school admins manage teachers.
 */

const KC_URL  = () => process.env.KEYCLOAK_URL;
const KC_USER = () => process.env.KEYCLOAK_ADMIN;
const KC_PASS = () => process.env.KEYCLOAK_ADMIN_PASSWORD;

async function getAdminToken() {
    const resp = await fetch(`${KC_URL()}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=admin-cli&username=${KC_USER()}&password=${KC_PASS()}&grant_type=password`,
    });
    if (!resp.ok) throw new Error('Cannot get Keycloak admin token');
    const data = await resp.json();
    return data.access_token;
}

function authHeaders(token) {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd + '!1';  // ensure it meets basic complexity
}

/**
 * Create a Keycloak user for a teacher.
 * @returns {{ keycloakUserId: string, tempPassword: string }}
 */
export async function createTeacherUser(realm, { email, firstName, lastName, schoolId, teacherId }) {
    const token = await getAdminToken();

    // 1. Create user
    const createResp = await fetch(`${KC_URL()}/admin/realms/${realm}/users`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
            username: email,
            email,
            firstName,
            lastName,
            emailVerified: true,
            enabled: true,
            attributes: {
                school_id: [schoolId],
                teacher_id: [teacherId],
            },
        }),
    });

    if (createResp.status === 409) {
        throw new Error(`A Keycloak user with email ${email} already exists in realm ${realm}`);
    }
    if (!createResp.ok && createResp.status !== 201) {
        const body = await createResp.text();
        throw new Error(`Keycloak user creation failed: ${body}`);
    }

    // 2. Extract user ID from Location header
    const location = createResp.headers.get('location') || createResp.headers.get('Location') || '';
    const keycloakUserId = location.split('/').pop();
    if (!keycloakUserId || keycloakUserId === location) {
        throw new Error('Could not extract user ID from Keycloak response');
    }

    // 3. Set temporary password
    const tempPassword = generateTempPassword();
    await fetch(`${KC_URL()}/admin/realms/${realm}/users/${keycloakUserId}/reset-password`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ type: 'password', value: tempPassword, temporary: true }),
    });

    // 4. Get TEACHER role definition
    const roleResp = await fetch(`${KC_URL()}/admin/realms/${realm}/roles/TEACHER`, {
        headers: authHeaders(token),
    });
    if (!roleResp.ok) throw new Error('TEACHER role not found in realm');
    const role = await roleResp.json();

    // 5. Assign TEACHER role
    await fetch(`${KC_URL()}/admin/realms/${realm}/users/${keycloakUserId}/role-mappings/realm`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify([role]),
    });

    return { keycloakUserId, tempPassword };
}

/**
 * Delete a Keycloak user (called on teacher hard-delete).
 */
export async function deleteKeycloakUser(realm, keycloakUserId) {
    const token = await getAdminToken();
    await fetch(`${KC_URL()}/admin/realms/${realm}/users/${keycloakUserId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
    });
}
