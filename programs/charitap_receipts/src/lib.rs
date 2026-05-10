use anchor_lang::prelude::*;

declare_id!("Dtus14VRphsjYnPsT4F1eUeTN88dEAGHGsdcee6vTVgm");

#[program]
pub mod charitap_receipts {
    use super::*;

    pub fn mint_receipt(
        ctx: Context<MintReceipt>,
        receipt_id: [u8; 32],
        charity_id_hash: [u8; 32],
        amount_cents: u64,
        timestamp: i64,
        memo_hash: [u8; 32],
        payment_rail: u8,
    ) -> Result<()> {
        require!(amount_cents > 0, CharitapError::InvalidAmount);

        let receipt = &mut ctx.accounts.receipt;
        receipt.receipt_id = receipt_id;
        receipt.charity_id_hash = charity_id_hash;
        receipt.amount_cents = amount_cents;
        receipt.timestamp = timestamp;
        receipt.memo_hash = memo_hash;
        receipt.payment_rail = payment_rail;
        receipt.payer = ctx.accounts.payer.key();
        receipt.bump = ctx.bumps.receipt;

        let charity_total = &mut ctx.accounts.charity_total;
        if charity_total.charity_id_hash == [0; 32] {
            charity_total.charity_id_hash = charity_id_hash;
            charity_total.bump = ctx.bumps.charity_total;
        }
        charity_total.total_cents = charity_total
            .total_cents
            .checked_add(amount_cents)
            .ok_or(CharitapError::TotalOverflow)?;
        charity_total.receipt_count = charity_total
            .receipt_count
            .checked_add(1)
            .ok_or(CharitapError::TotalOverflow)?;

        emit!(ReceiptMinted {
            receipt_id,
            charity_id_hash,
            amount_cents,
            timestamp,
            memo_hash,
            payment_rail,
            receipt: receipt.key(),
            charity_total: charity_total.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(receipt_id: [u8; 32], charity_id_hash: [u8; 32])]
pub struct MintReceipt<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = DonationReceipt::SPACE,
        seeds = [b"receipt", receipt_id.as_ref()],
        bump
    )]
    pub receipt: Account<'info, DonationReceipt>,
    #[account(
        init_if_needed,
        payer = payer,
        space = CharityTotal::SPACE,
        seeds = [b"charity_total", charity_id_hash.as_ref()],
        bump
    )]
    pub charity_total: Account<'info, CharityTotal>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct DonationReceipt {
    pub receipt_id: [u8; 32],
    pub charity_id_hash: [u8; 32],
    pub amount_cents: u64,
    pub timestamp: i64,
    pub memo_hash: [u8; 32],
    pub payment_rail: u8,
    pub payer: Pubkey,
    pub bump: u8,
}

impl DonationReceipt {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 32 + 1 + 32 + 1;
}

#[account]
pub struct CharityTotal {
    pub charity_id_hash: [u8; 32],
    pub total_cents: u64,
    pub receipt_count: u64,
    pub bump: u8,
}

impl CharityTotal {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 1;
}

#[event]
pub struct ReceiptMinted {
    pub receipt_id: [u8; 32],
    pub charity_id_hash: [u8; 32],
    pub amount_cents: u64,
    pub timestamp: i64,
    pub memo_hash: [u8; 32],
    pub payment_rail: u8,
    pub receipt: Pubkey,
    pub charity_total: Pubkey,
}

#[error_code]
pub enum CharitapError {
    #[msg("Donation amount must be greater than zero")]
    InvalidAmount,
    #[msg("Charity total overflow")]
    TotalOverflow,
}
