export interface User{
    id: string
    first_name: string
    last_name: string
    other_name: string
    email: string
    role: string
    status: string
    lastLogin: string
    joinDate: string
    contact: string
    gender: string
    dob: string
    hasAccount: boolean
    fullName: string
    account: Account
    password?: string // Optional field for password, not returned in queries

}
export interface Loansummary {
    id:string
    loanId:string
    monthlyPayment: number
    totalInterest: number
    remainingBalance: number
}
export interface Loan {
    id: string
    accountId: string
    amount: number
    interestRate: number
    status: string
    endDate: string
    startDate: string
    term: number
    summary?: Loansummary
    createAt: string
    updateAt: string
    // account?: Account
}
export interface Transaction {
    id: string
    type: string
    amount: number
    accountId: string
    acountName: string
    status: string
    description: string
    loanId: string
    createdAt: string
    updateAt: string
}
export interface Account {
    id: string
    userId: string
    accountNumber: string
    balance: number
    status: string
    paidMembership: boolean
    hasLoan: boolean
    is_deleted: boolean
    deleted_at: string
    owner: User
    loans: Loan[]
    transactions: Transaction[]
}