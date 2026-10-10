import { Account, LoginInput, User } from "@/types";
import { RESTDataSource, AugmentedRequest } from "@apollo/datasource-rest";
import { GraphQLError } from "graphql";

const CODE_BY_STATUS = new Map([
    [400, 'BAD_USER_INPUT'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
]);


// Who made the GraphQL request: forwarded to the REST API for its audit trail
export interface RequestOrigin {
    actor?: { userId: string; email?: string; role: string } | null;
    client?: 'web' | 'mobile' | null;
    ip?: string | null;
    userAgent?: string | null;
    origin?: string | null;
    queuedAt?: string | null;
}

type RestContext = { token?: string; apiKey?: string } & RequestOrigin;

// Headers every call to the REST API carries: the internal key, and who is behind the request
export const restHeaders = (ctx: RestContext): Record<string, string> => {
    const headers: Record<string, string> = { 'graph-api-key': ctx.apiKey || process.env.INTERNAL_API_KEY || '' };
    const origin: Record<string, string | null | undefined> = {
        'x-actor-id': ctx.actor?.userId,
        'x-actor-email': ctx.actor?.email,
        'x-actor-role': ctx.actor?.role,
        'x-client': ctx.client,
        'x-client-ip': ctx.ip,
        'x-client-ua': ctx.userAgent,
        'x-client-origin': ctx.origin,
        'x-queued-at': ctx.queuedAt,
    };
    for (const [name, value] of Object.entries(origin)) {
        if (value) headers[name] = String(value);
    }
    return headers;
};

export class RestAPI extends RESTDataSource {
    context!: RestContext;
    override baseURL = `${process.env.REST_API_URL}/api/`;
    constructor() {
        super();
        console.log('RestAPI baseURL:', this.baseURL); // Debug log baseURL
    }

    override willSendRequest(path: string, request: AugmentedRequest): void {
        Object.assign(request.headers, restHeaders(this.context));
        // if (ctx.token) {
        //     request.headers['Authorization'] = `Bearer ${ctx.token}`;
        // }
        //  console.log(`[RestAPI] sending request to ${path} with headers:`, {
        //     'graph-api-key': request.headers['graph-api-key'],
        // });
    }

    // The REST API explains rejections as { error: "..." }: pass that message on instead of "400: Bad Request"
    // (extensions.response keeps the status for resolvers that branch on it, e.g. login)
    override async errorFromResponse({ response, parsedBody }: Parameters<RESTDataSource['errorFromResponse']>[0]) {
        const body = parsedBody as { error?: unknown } | undefined;
        const message = typeof body?.error === 'string' && body.error ? body.error : `${response.status}: ${response.statusText}`;
        const code = CODE_BY_STATUS.get(response.status) ?? (response.status >= 500 ? 'INTERNAL_SERVER_ERROR' : undefined);
        return new GraphQLError(message, {
            extensions: {
                ...(code && { code }),
                response: { url: response.url, status: response.status, statusText: response.statusText, body: parsedBody },
            },
        });
    }

    async initialize({context}: {context: RestContext}): Promise<void> {
        this.context = context;
    }

    // A session that changed during this request (sign-in) is audited as that member
    setActor(actor: RequestOrigin['actor']) {
        this.context.actor = actor;
    }

    // Requests to /api/users
    async getAllUsers() {
        return this.get('users');
    }

    async getUserById(id: string) {
        // console.log('Fetching user by ID:', id);
        const res = await this.get(`users?userId=${id}`);
        // console.log('Response from getUserById:', res);
        return res;
    }

    async createUser(user: any) {
        return this.post('users', { body: user });
    }

    // POST /<resource>/bulk -> per-row results
    async bulkCreate(resource: 'users' | 'transactions' | 'loans', rows: any[]) {
        const response = await this.post(`${resource}/bulk`, { body: { rows } });
        return response.results;
    }

    async updateUser(id: string, user: Partial<User>) {
        return this.patch(`users/${id}`, { body: user });
    }

    async changePassword(id: string, body: { currentPassword: string, newPassword: string }) {
        return this.post(`users/${id}/password`, { body });
    }

    async changeEmail(id: string, body: { email: string, password: string }) {
        return this.post(`users/${id}/email`, { body });
    }

    async getNotifications(userId: string, limit?: number, unreadOnly = false) {
        const query = new URLSearchParams({ ...(limit && { limit: String(limit) }), ...(unreadOnly && { unread: 'true' }) }).toString();
        return this.get(`users/${userId}/notifications${query ? `?${query}` : ''}`);
    }

    async markNotificationsRead(userId: string, ids: string[] | null) {
        return this.post(`users/${userId}/notifications/read`, { body: ids ? { ids } : {} });
    }

    async deleteUser(id: string) {
        return this.delete(`users/${id}`);
    }

    // Requests to /api/accounts
    async getAllAccounts() {
        return this.get('accounts');
    }

    async getAccountById(id: string) {
        const res = await this.get(`accounts?accountId=${id}`);
        // console.log('Response from getAccountById:', res);
        return res;
    }

    async getAccountByUserId(id: string) {
        const res = await this.get(`accounts?userId=${id}`);
        // console.log('Response from getAccountByUserId:', res);
        return res;
        // return this.get(`accounts?userId=${id}`);
    }
    async createAccount(account: any) {
        const res = await this.post('accounts', { body: account });
        // console.log('Response from createAccount:', res);
        return res;
        // return this.post('accounts', { body: account });
    }

    async updateAccount(id: string, updateData: Partial<Account>) {
        return this.patch(`accounts/${id}`, { body: updateData });
    }   

    async deleteAccount(id: string) {
        return this.delete(`accounts/${id}`);
    }


    // Requests to /api/loans
    async getAllLoans() {
        return this.get('loans');
    }

    async getLoanApplications(view: string) {
        return this.get(`loans/applications?view=${encodeURIComponent(view)}`);
    }

    async getLoansByStatus(status: string) {
        return this.get(`loans?status=${encodeURIComponent(status)}`);
    }

    async applyForLoan(application: { userId: string, amount: number, term: number, purpose?: string, startDate?: string }) {
        return this.post('loans/applications', { body: application });
    }

    async approveLoan(id: string, decision: { interestRate?: number, startDate?: string, note?: string }) {
        return this.post(`loans/${id}/approve`, { body: decision });
    }

    async payLoanFromSavings(id: string, amount: number) {
        return this.post(`loans/${id}/pay-from-savings`, { body: { amount } });
    }

    async rejectLoan(id: string, reason: string) {
        return this.post(`loans/${id}/reject`, { body: { reason } });
    }

    async getLoanSettings() {
        return this.get('settings/loans');
    }

    async getLoansByAccountId(id: string) {
        return this.get(`loans?accountId=${id}`);
    }

    async createLoan(loan: any) {
        return this.post('loans', { body: loan });
    }

    async updateLoan(id: string, loan: any) {
        return this.patch(`loans/${id}`, { body: loan });
    }

    async deleteLoan(id: string) {
        return this.delete(`loans/${id}`);
    }

    // Get loan summary by loanID
    async getLoanSummaryByLoanId(id: string) {
        const res = await this.get(`loans/${id}/summary`);
        // console.log('Response from getLoanSummaryByLoanId:', res);
        return res;
        // return this.get(`loans/${id}/summary`);
    }
    
    
    // Requests to /api/transactions
    async getAllTransactions() {
        return this.get('transactions');
    }

    async getTransactionsByAccountId(id: string) {
        return this.get(`transactions?accountId=${id}`);
    }

    async createTransaction(transaction: any) {
        return this.post('transactions', { body: transaction });
    }

    async updateTransaction(id: string, transaction: any) {
        return this.patch(`transactions/${id}`, { body: transaction });
    }

    async deleteTransaction(id: string) {
        return this.delete(`transactions/${id}`);
    }

    // Requests to /api/health and /api/debug

    async getHealthCheck(){
        return this.get('http://localhost:3001/health');
    }

    async debug(){
        return this.get('http://localhost:3001/debug/users');
    }

    async login({ email, password }: LoginInput) {
        return this.post('auth/login', { body: { email, password } });
    }

    // Sign-in steps, password reset and fingerprint sign-in (/api/auth)
    async verifyTwoFactor(challengeToken: string, code: string) {
        return this.post('auth/2fa/verify', { body: { challengeToken, code } });
    }

    async forgotPassword(email: string) {
        return this.post('auth/forgot-password', { body: { email } });
    }

    async replaceTemporaryPassword(userId: string, newPassword: string) {
        return this.post(`users/${userId}/password/initial`, { body: { newPassword } });
    }

    async enrollBiometric(userId: string, deviceName?: string | null) {
        return this.post('auth/biometric/enroll', { body: { userId, deviceName } });
    }

    async biometricLogin(deviceId: string, secret: string) {
        return this.post('auth/biometric/login', { body: { deviceId, secret } });
    }

    async revokeBiometric(userId: string, deviceId?: string | null) {
        return this.post('auth/biometric/revoke', { body: { userId, deviceId } });
    }

    async getTrustedDevices(userId: string) {
        return this.get(`auth/biometric/devices?userId=${encodeURIComponent(userId)}`);
    }

    // Offline changes: claim a key before running, then store the answer (see utils/idempotencyPlugin.ts)
    async claimIdempotency(key: string, operation: string | null) {
        return this.post('idempotency/claim', { body: { key, operation } });
    }

    async completeIdempotency(key: string, response: unknown) {
        return this.post('idempotency/complete', { body: { key, response } });
    }

    async releaseIdempotency(key: string) {
        return this.post('idempotency/release', { body: { key } });
    }

    // Passkeys (web)
    async passkeyRegistrationOptions(userId: string) {
        return this.post('auth/passkey/register/options', { body: { userId } });
    }

    async addPasskey(userId: string, body: { challengeToken: string; response: unknown; deviceName?: string | null }) {
        return this.post('auth/passkey/register/verify', { body: { ...body, userId } });
    }

    async passkeyLoginOptions(email?: string | null) {
        return this.post('auth/passkey/login/options', { body: { email } });
    }

    async passkeyLogin(challengeToken: string, response: unknown) {
        return this.post('auth/passkey/login/verify', { body: { challengeToken, response } });
    }

    async getPasskeys(userId: string) {
        return this.get(`auth/passkey/list?userId=${encodeURIComponent(userId)}`);
    }

    async removePasskey(userId: string, id: string) {
        return this.post('auth/passkey/remove', { body: { userId, id } });
    }

    async reportDeviceEvents(events: unknown[]) {
        return this.post('audit/device-events', { body: { events } });
    }

    // Events only the gateway sees (sign-out)
    async recordAudit(action: string, summary?: string) {
        return this.post('audit', { body: { action, summary } });
    }

    // Password reset requests (staff)
    async getPasswordResets(status?: string | null) {
        return this.get(`password-resets${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    }

    async getPasswordReset(id: string) {
        return this.get(`password-resets/${encodeURIComponent(id)}`);
    }

    async completePasswordReset(id: string, password: string) {
        return this.post(`password-resets/${encodeURIComponent(id)}/complete`, { body: { password } });
    }

    async dismissPasswordReset(id: string, note?: string | null) {
        return this.post(`password-resets/${encodeURIComponent(id)}/dismiss`, { body: { note } });
    }

    // Audit trail (ADMIN)
    async getAuditLogs(filter: Record<string, unknown>) {
        const query = new URLSearchParams(
            Object.entries(filter).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => [key, String(value)])
        ).toString();
        return this.get(`audit-logs${query ? `?${query}` : ''}`);
    }

    async getAuditFacets() {
        return this.get('audit-logs/facets');
    }

    // Bookkeeping reports and dashboard figures (staff)
    async getReport(type: string, params: Record<string, unknown>) {
        const query = new URLSearchParams(
            Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => [key, String(value)])
        ).toString();
        return this.get(`reports/${encodeURIComponent(type)}${query ? `?${query}` : ''}`);
    }

    async getDashboardStats(range: string) {
        return this.get(`stats/dashboard?range=${encodeURIComponent(range)}`);
    }
}
