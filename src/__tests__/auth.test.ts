// Sign-in through the gateway: answers, error codes the apps branch on, and the session cookie
import { fakeRest, run, tokenFor } from './support/harness.js';

const LOGIN = 'mutation { login(email: "jane@test.sacco", password: "member123") { success token twoFactorRequired challengeToken mustChangePassword } }';

// What RESTDataSource throws for an HTTP error answer
const restError = (status: number, body: Record<string, unknown> = {}) => () => {
  throw Object.assign(new Error(`${status}`), { extensions: { response: { status, body } } });
};

describe('sign-in', () => {
  it('returns the session and sets the httpOnly cookie', async () => {
    const token = tokenFor({ userId: 'jane' });
    const res = await run(LOGIN, { rest: fakeRest({ login: { token, user: { id: 'jane' } } }) });
    expect(res.data.login).toMatchObject({ success: true, token, twoFactorRequired: false, mustChangePassword: false });
    expect(res.cookies.set).toEqual([['token', token]]);
  });

  it('with 2-step on, returns the challenge and no session (an old cookie is cleared)', async () => {
    const res = await run(LOGIN, { rest: fakeRest({ login: { twoFactorRequired: true, challengeToken: 'challenge', user: { first_name: 'Jane' } } }) });
    expect(res.data.login).toMatchObject({ token: null, twoFactorRequired: true, challengeToken: 'challenge' });
    expect(res.cookies.set).toEqual([]);
    expect(res.cookies.cleared).toEqual(['token']);
  });

  it.each([
    [restError(401, { error: 'Invalid email or password' }), 'INVALID_CREDENTIALS'],
    [restError(401, { error: 'expired', code: 'TEMP_PASSWORD_EXPIRED' }), 'TEMP_PASSWORD_EXPIRED'],
    [restError(500), 'SERVER_ERROR'],
    [() => { throw new Error('connect ECONNREFUSED'); }, 'REST_API_UNREACHABLE'],
  ])('maps a failed sign-in to %#: %s', async (login, code) => {
    const res = await run(LOGIN, { rest: fakeRest({ login }) });
    expect(res.codes).toEqual([code]);
    expect(res.cookies.set).toEqual([]);
  });

  it('maps a wrong 2-step code and a revoked fingerprint phone', async () => {
    const wrongCode = await run('mutation { verifyTwoFactor(challengeToken: "c", code: "000000") { token } }', { rest: fakeRest({ verifyTwoFactor: restError(400, { error: 'That code is not correct' }) }) });
    expect(wrongCode.codes).toEqual(['INVALID_CODE']);
    const revoked = await run('mutation { biometricLogin(deviceId: "d", secret: "s") { token } }', { rest: fakeRest({ biometricLogin: restError(401, { error: 'Revoked', code: 'DEVICE_REVOKED' }) }) });
    expect(revoked.codes).toEqual(['DEVICE_REVOKED']);
  });

  it('signing out clears the cookie, even with an expired session', async () => {
    const rest = fakeRest();
    const res = await run('mutation { logout }', { token: 'expired-or-garbage', rest });
    expect(res.data.logout).toBe(true);
    expect(res.cookies.cleared).toEqual(['token']);
    expect(rest.recordAudit).not.toHaveBeenCalled();

    const signedIn = await run('mutation { logout }', { token: tokenFor({ userId: 'jane' }), rest });
    expect(signedIn.data.logout).toBe(true);
    expect(rest.recordAudit).toHaveBeenCalledWith('LOGOUT', 'Signed out');
  });

  it('only accepts offline phone events from a signed-in session', async () => {
    const query = 'mutation($events: [DeviceEventInput!]!) { reportDeviceEvents(events: $events) }';
    const variables = { events: [{ id: 'aaaaaaaa-1111-4111-8111-000000000001', action: 'LOGOUT', email: 'jane@test.sacco', at: new Date().toISOString() }] };
    const rest = fakeRest({ reportDeviceEvents: { recorded: 1 } });
    expect((await run(query, { variables, rest })).codes).toEqual(['UNAUTHORIZED']);
    expect((await run(query, { variables, rest, token: tokenFor({ userId: 'jane' }) })).data.reportDeviceEvents).toBe(1);
  });
});
