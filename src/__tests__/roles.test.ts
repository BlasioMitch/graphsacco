// Who may do what: the gateway is where roles and "own records only" are enforced
import { challengeToken, fakeRest, run, tokenFor } from './support/harness.js';

const member = tokenFor({ userId: 'member-1', role: 'USER' });
const manager = tokenFor({ userId: 'manager-1', role: 'MANAGER' });
const admin = tokenFor({ userId: 'admin-1', role: 'ADMIN' });

describe('roles', () => {
  it('needs a valid session token', async () => {
    expect((await run('{ getUsers { id } }')).codes).toEqual(['UNAUTHORIZED']);
    expect((await run('{ getUsers { id } }', { token: 'forged.token.value' })).codes).toEqual(['UNAUTHORIZED']);
    // A 2-step challenge proves the password only, so it is not a session
    expect((await run('{ me { id } }', { token: challengeToken() })).codes).toEqual(['UNAUTHORIZED']);
  });

  it('keeps staff lists and changes from members, without calling the REST API', async () => {
    const rest = fakeRest({ getUsers: [] });
    for (const query of [
      '{ getUsers { id } }',
      '{ getTransactions { id } }',
      '{ getLoans { id } }',
      '{ getAccounts { id } }',
      'mutation { deleteUser(id: "x") }',
      'mutation { approveLoan(id: "x") { id } }',
    ]) {
      expect((await run(query, { token: member, rest })).codes).toEqual(['FORBIDDEN']);
    }
    expect(rest.getUsers).not.toHaveBeenCalled();
    expect((await run('{ getUsers { id } }', { token: manager, rest })).errors).toBeUndefined();
  });

  it('opens the audit trail to ADMIN only', async () => {
    const rest = fakeRest({ getAuditLogs: { items: [], total: 0, limit: 50, offset: 0 } });
    const query = '{ auditLogs { total } }';
    expect((await run(query, { token: manager, rest })).codes).toEqual(['FORBIDDEN']);
    expect((await run(query, { token: admin, rest })).data.auditLogs.total).toBe(0);
  });

  it("lets a member see their own account and profile, not someone else's", async () => {
    const rest = fakeRest({
      getAccountById: (id: string) => ({ id, userId: id === 'mine' ? 'member-1' : 'member-2', accountNumber: 'AB-1', balance: 0, status: 'ACTIVE' }),
      getUserById: (id: string) => ({ id, first_name: 'A', last_name: 'B', email: 'a@b.c', role: 'USER', status: 'ACTIVE', contact: '1', dob: '1990-01-01', gender: 'MALE' }),
    });
    expect((await run('{ getAccountById(id: "mine") { id } }', { token: member, rest })).data.getAccountById.id).toBe('mine');
    expect((await run('{ getAccountById(id: "theirs") { id } }', { token: member, rest })).codes).toEqual(['FORBIDDEN']);
    expect((await run('{ getUserById(id: "member-2") { id } }', { token: member, rest })).codes).toEqual(['FORBIDDEN']);
    expect((await run('{ getAccountById(id: "theirs") { id } }', { token: manager, rest })).errors).toBeUndefined();
  });

  it('takes the applicant from the session, never from the request', async () => {
    const rest = fakeRest({ applyForLoan: { id: 'loan-1', status: 'PENDING' } });
    await run('mutation { applyForLoan(input: { amount: 500000, term: 6 }) { id } }', { token: member, rest });
    expect(rest.applyForLoan).toHaveBeenCalledWith(expect.objectContaining({ userId: 'member-1', amount: 500000, term: 6 }));
  });

  it("lets staff change only another member's role and status", async () => {
    const rest = fakeRest({ updateUser: { id: 'member-1' } });
    const blocked = await run('mutation { updateUser(id: "member-1", updateData: { first_name: "X" }) { id } }', { token: manager, rest });
    expect(blocked.codes).toEqual(['FORBIDDEN']);
    expect(rest.updateUser).not.toHaveBeenCalled();
    await run('mutation { updateUser(id: "member-1", updateData: { status: INACTIVE }) { id } }', { token: manager, rest });
    expect(rest.updateUser).toHaveBeenCalledWith('member-1', { status: 'INACTIVE' });
  });

  it('limits a temporary-password session to choosing a new password', async () => {
    const temporary = tokenFor({ userId: 'member-1', mustChangePassword: true });
    expect((await run('{ myNotifications { unreadCount } }', { token: temporary })).codes).toEqual(['PASSWORD_CHANGE_REQUIRED']);
    const rest = fakeRest({ replaceTemporaryPassword: { token: tokenFor({ userId: 'member-1' }), user: { id: 'member-1' }, mustChangePassword: false } });
    const res = await run('mutation { setNewPassword(newPassword: "brandNew2026") { success mustChangePassword } }', { token: temporary, rest });
    expect(res.data.setNewPassword).toEqual({ success: true, mustChangePassword: false });
    expect(rest.replaceTemporaryPassword).toHaveBeenCalledWith('member-1', 'brandNew2026');
  });
});
