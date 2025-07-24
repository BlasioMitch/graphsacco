import { Account, User } from "@/types";
import { RESTDataSource, AugmentedRequest } from "@apollo/datasource-rest";


export class RestAPI extends RESTDataSource {
    context!: { token?: string; apiKey?: string }; // Add context property
    override baseURL = process.env.REST_API_URL;
    constructor() {
        super();
        console.log('RestAPI baseURL:', this.baseURL); // Debug log baseURL
    }

    override willSendRequest(path: string, request: AugmentedRequest): void {
        const ctx = this.context as { token? : string, apiKey?: string };
        request.headers['graph-api-key'] = ctx.apiKey || process.env.INTERNAL_API_KEY || '';
        if (ctx.token) {
            request.headers['Authorization'] = `Bearer ${ctx.token}`;
        }
    }

    async initialize({context}: {context: { token?: string; apiKey?: string }}): Promise<void> {
        this.context = context; // Set the context property
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

    async updateUser(id: string, user: Partial<User>) {
        return this.patch(`users/${id}`, { body: user });
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
        console.log('Response from createAccount:', res);
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

    async login({ email, password }: { email: string, password: string }) {
        // try {
            const result = await this.post('auth/login', { body: { email, password } });
            console.log('REST API login response:', result); // Debug log response
            return result;
    //     } catch (error) {
    //         console.error('REST API login error:', error);
    //         throw error;
    //     }
    // }
    }
   
}