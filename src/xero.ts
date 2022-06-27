import { ManualJournal, ManualJournalLine, TokenSet, XeroClient } from 'xero-node'

export class Xero {
    private clientId: string
    private clientSecret: string
    private redirectUri: string
    private token!: TokenSet
    private client!: XeroClient

    constructor(clientId: string, clientSecret: string, redirectUri: string, tokenData?: TokenSet) {
        this.clientId = clientId
        this.clientSecret = clientSecret
        this.redirectUri = redirectUri
        if (tokenData) {
            if (!this.isValidToken(tokenData)) {
                throw new Error(`Invalid token data.`)
            }

            this.token = tokenData
        }
    }

    private isValidToken(tokenData: TokenSet): boolean {
        const keys = Object.keys(tokenData)
        if (!keys.includes('access_token') || !keys.includes('refresh_token')) {
            return false
        }
        return true
    }

    public getConsentUrl(): Promise<string> {
        return this.client.buildConsentUrl()
    }

    public async initClient(): Promise<void> {
        this.client = new XeroClient({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            redirectUris: [this.redirectUri],
            scopes: ['accounting.settings', 'accounting.transactions', 'offline_access'],
        })
        await this.client.initialize()
        this.refreshToken()
    }

    public async refreshToken(): Promise<void> {
        if (!this.token) {
            return
        }

        const token: TokenSet = this.token
        this.client.setTokenSet(token)
        if (this.client.readTokenSet().expired()) {
            // refresh the token
            await this.client.refreshToken()
        }

        await this.client.updateTenants()
    }

    public async processCallback(requestUrl: string): Promise<TokenSet> {
        const tokenSet = await this.client.apiCallback(requestUrl)
        await this.client.updateTenants()
        return tokenSet
    }

    public async createJournal(data: JournalData) {
        try {
            const journalLines: ManualJournalLine[] = []
            data.journalLines.forEach((i: any) => {
                journalLines.push({
                    accountCode: i.accountCode,
                    lineAmount: typeof i.amount === 'string' ? parseFloat(i.amount) : i.amount,
                    description: i.description,
                })
            })

            const journal: ManualJournal = {
                status: (!data.status ? 'DRAFT' : data.status) as unknown as ManualJournal.StatusEnum,
                narration: data.narration,
                date: data.date,
                journalLines: journalLines,
            }
            const tenantId = this.client.tenants[0].tenantId
            await this.client.accountingApi.createManualJournals(tenantId, { manualJournals: [journal] })
        } catch (error: any) {
            const err = JSON.stringify(error.response.body, null, 2)

            return {
                statusCode: error.response.statusCode,
                message: error.response.statusMessage,
            }
        }
        return {
            statusCode: 200,
            message: 'Successfully created journal.',
        }
    }

    public async getAccounts() {
        const tenantId = this.client.tenants[0].tenantId
        const data = await this.client.accountingApi.getAccounts(tenantId)
        if (!data.body.accounts) {
            throw new Error(`No accounts found.`)
        }
        return data.body.accounts.map(i => {
            return {
                id: i.accountID,
                code: i.code,
                name: i.name,
                type: i,
            }
        })
    }
}
