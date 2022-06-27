type JournalData = {
    status: string
    date: string
    narration: string
    journalLines: {
        accountCoude: string
        amount: number
        description: string
    }[]
}
