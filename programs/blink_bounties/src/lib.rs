use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("3MAR3HqMntaDfPE1Vmf1XGBeCEv2dykXUCjwsMB8gF1S");

const MAX_DESCRIPTION_LEN: usize = 280;
const MAX_WORK_URL_LEN: usize = 300;

#[program]
pub mod blink_bounties {
    use super::*;

    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        bounty_id: u64,
        amount: u64,
        description: String,
    ) -> Result<()> {
        require!(amount > 0, BountyError::InvalidAmount);
        require!(
            description.as_bytes().len() <= MAX_DESCRIPTION_LEN,
            BountyError::DescriptionTooLong
        );

        let bounty = &mut ctx.accounts.bounty;
        bounty.creator = ctx.accounts.creator.key();
        bounty.bounty_id = bounty_id;
        bounty.amount = amount;
        bounty.description = description;
        bounty.claimant = None;
        bounty.work_url = None;
        bounty.status = BountyStatus::Open;
        bounty.bump = ctx.bumps.bounty;

        let cpi_accounts = Transfer {
            from: ctx.accounts.creator.to_account_info(),
            to: bounty.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
        system_program::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn submit_work(ctx: Context<SubmitWork>, work_url: String) -> Result<()> {
        require!(
            work_url.as_bytes().len() <= MAX_WORK_URL_LEN,
            BountyError::WorkUrlTooLong
        );

        let bounty = &mut ctx.accounts.bounty;
        require!(bounty.status == BountyStatus::Open, BountyError::InvalidStatus);

        match bounty.claimant {
            Some(current_claimant) => {
                require_keys_eq!(current_claimant, ctx.accounts.claimant.key(), BountyError::Unauthorized);
            }
            None => {
                bounty.claimant = Some(ctx.accounts.claimant.key());
            }
        }

        bounty.work_url = Some(work_url);
        bounty.status = BountyStatus::Submitted;
        Ok(())
    }

    pub fn approve_bounty(ctx: Context<ApproveBounty>) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;

        require_keys_eq!(bounty.creator, ctx.accounts.creator.key(), BountyError::Unauthorized);
        require!(bounty.status == BountyStatus::Submitted, BountyError::InvalidStatus);

        let claimant = bounty.claimant.ok_or(BountyError::MissingClaimant)?;
        require_keys_eq!(claimant, ctx.accounts.claimant.key(), BountyError::Unauthorized);

        let payout = bounty.amount;
        require!(payout > 0, BountyError::InvalidAmount);

        {
            let bounty_info = bounty.to_account_info();
            let claimant_info = ctx.accounts.claimant.to_account_info();
            let bounty_lamports = &mut **bounty_info.try_borrow_mut_lamports()?;
            let claimant_lamports = &mut **claimant_info.try_borrow_mut_lamports()?;
            *bounty_lamports = bounty_lamports
                .checked_sub(payout)
                .ok_or(BountyError::MathOverflow)?;
            *claimant_lamports = claimant_lamports
                .checked_add(payout)
                .ok_or(BountyError::MathOverflow)?;
        }

        bounty.amount = 0;
        bounty.status = BountyStatus::Completed;
        Ok(())
    }

    pub fn cancel_bounty(ctx: Context<CancelBounty>) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;

        require_keys_eq!(bounty.creator, ctx.accounts.creator.key(), BountyError::Unauthorized);
        require!(bounty.status == BountyStatus::Open, BountyError::InvalidStatus);

        let refund = bounty.amount;
        if refund > 0 {
            let bounty_info = bounty.to_account_info();
            let creator_info = ctx.accounts.creator.to_account_info();
            let bounty_lamports = &mut **bounty_info.try_borrow_mut_lamports()?;
            let creator_lamports = &mut **creator_info.try_borrow_mut_lamports()?;
            *bounty_lamports = bounty_lamports
                .checked_sub(refund)
                .ok_or(BountyError::MathOverflow)?;
            *creator_lamports = creator_lamports
                .checked_add(refund)
                .ok_or(BountyError::MathOverflow)?;
        }

        bounty.amount = 0;
        bounty.status = BountyStatus::Cancelled;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bounty_id: u64)]
pub struct CreateBounty<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = Bounty::INIT_SPACE,
        seeds = [b"bounty", creator.key().as_ref(), &bounty_id.to_le_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitWork<'info> {
    pub claimant: Signer<'info>,
    #[account(mut)]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct ApproveBounty<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub claimant: SystemAccount<'info>,
    #[account(mut)]
    pub bounty: Account<'info, Bounty>,
}

#[derive(Accounts)]
pub struct CancelBounty<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub bounty: Account<'info, Bounty>,
}

#[account]
pub struct Bounty {
    pub creator: Pubkey,
    pub bounty_id: u64,
    pub amount: u64,
    pub description: String,
    pub claimant: Option<Pubkey>,
    pub work_url: Option<String>,
    pub status: BountyStatus,
    pub bump: u8,
}

impl Bounty {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // creator
        8 + // bounty_id
        8 + // amount
        (4 + MAX_DESCRIPTION_LEN) + // description
        (1 + 32) + // claimant option
        (1 + 4 + MAX_WORK_URL_LEN) + // work_url option
        1 + // status enum
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BountyStatus {
    Open,
    Submitted,
    Completed,
    Cancelled,
}

#[error_code]
pub enum BountyError {
    #[msg("Only positive amounts are allowed")]
    InvalidAmount,
    #[msg("Bounty description exceeds max length")]
    DescriptionTooLong,
    #[msg("Work URL exceeds max length")]
    WorkUrlTooLong,
    #[msg("Invalid bounty status for this operation")]
    InvalidStatus,
    #[msg("Claimant is required before approval")]
    MissingClaimant,
    #[msg("Unauthorized signer or account")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
}
