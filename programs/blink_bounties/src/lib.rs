use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("3MAR3HqMntaDfPE1Vmf1XGBeCEv2dykXUCjwsMB8gF1S");

const MAX_TITLE_LEN: usize = 80;
const MAX_DESCRIPTION_LEN: usize = 280;
const MAX_IMAGE_URL_LEN: usize = 300;

#[program]
pub mod blink_bounties {
    use super::*;

    pub fn create_raffle(
        ctx: Context<CreateRaffle>,
        raffle_id: u64,
        ticket_price: u64,
        max_tickets: u32,
        title: String,
        description: String,
        image_url: String,
    ) -> Result<()> {
        require!(ticket_price > 0, RaffleError::InvalidAmount);
        require!(max_tickets > 0, RaffleError::InvalidTicketQuantity);
        require!(title.as_bytes().len() <= MAX_TITLE_LEN, RaffleError::TitleTooLong);
        require!(
            description.as_bytes().len() <= MAX_DESCRIPTION_LEN,
            RaffleError::DescriptionTooLong
        );
        require!(
            image_url.as_bytes().len() <= MAX_IMAGE_URL_LEN,
            RaffleError::ImageUrlTooLong
        );

        let raffle = &mut ctx.accounts.raffle;
        raffle.seller = ctx.accounts.seller.key();
        raffle.raffle_id = raffle_id;
        raffle.ticket_price = ticket_price;
        raffle.max_tickets = max_tickets;
        raffle.sold_tickets = 0;
        raffle.title = title;
        raffle.description = description;
        raffle.image_url = image_url;
        raffle.status = RaffleStatus::Open;
        raffle.bump = ctx.bumps.raffle;

        Ok(())
    }

    pub fn buy_tickets(ctx: Context<BuyTickets>, quantity: u8) -> Result<()> {
        require!(quantity > 0, RaffleError::InvalidTicketQuantity);

        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Open, RaffleError::RaffleClosed);

        let quantity_u32 = quantity as u32;
        let new_sold_tickets = raffle
            .sold_tickets
            .checked_add(quantity_u32)
            .ok_or(RaffleError::MathOverflow)?;
        require!(new_sold_tickets <= raffle.max_tickets, RaffleError::SoldOut);

        let total_cost = raffle
            .ticket_price
            .checked_mul(quantity as u64)
            .ok_or(RaffleError::MathOverflow)?;

        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: raffle.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
        system_program::transfer(cpi_ctx, total_cost)?;

        raffle.sold_tickets = new_sold_tickets;

        let buyer_position = &mut ctx.accounts.buyer_position;
        if buyer_position.buyer == Pubkey::default() {
            buyer_position.raffle = raffle.key();
            buyer_position.buyer = ctx.accounts.buyer.key();
            buyer_position.tickets = 0;
            buyer_position.spent = 0;
            buyer_position.bump = ctx.bumps.buyer_position;
        }

        buyer_position.tickets = buyer_position
            .tickets
            .checked_add(quantity_u32)
            .ok_or(RaffleError::MathOverflow)?;
        buyer_position.spent = buyer_position
            .spent
            .checked_add(total_cost)
            .ok_or(RaffleError::MathOverflow)?;

        Ok(())
    }

    pub fn close_raffle(ctx: Context<CloseRaffle>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        require_keys_eq!(raffle.seller, ctx.accounts.seller.key(), RaffleError::Unauthorized);
        require!(raffle.status == RaffleStatus::Open, RaffleError::RaffleClosed);
        raffle.status = RaffleStatus::Closed;
        Ok(())
    }

    pub fn claim_proceeds(ctx: Context<ClaimProceeds>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        require_keys_eq!(raffle.seller, ctx.accounts.seller.key(), RaffleError::Unauthorized);

        let rent_floor = Rent::get()?.minimum_balance(Raffle::INIT_SPACE);
        let raffle_info = raffle.to_account_info();
        let seller_info = ctx.accounts.seller.to_account_info();

        let raffle_lamports = **raffle_info.lamports.borrow();
        let available = raffle_lamports.saturating_sub(rent_floor);
        require!(available > 0, RaffleError::NothingToClaim);

        {
            let raffle_lamports_mut = &mut **raffle_info.try_borrow_mut_lamports()?;
            let seller_lamports_mut = &mut **seller_info.try_borrow_mut_lamports()?;
            *raffle_lamports_mut = raffle_lamports_mut
                .checked_sub(available)
                .ok_or(RaffleError::MathOverflow)?;
            *seller_lamports_mut = seller_lamports_mut
                .checked_add(available)
                .ok_or(RaffleError::MathOverflow)?;
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct CreateRaffle<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = Raffle::INIT_SPACE,
        seeds = [b"raffle", seller.key().as_ref(), &raffle_id.to_le_bytes()],
        bump
    )]
    pub raffle: Account<'info, Raffle>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = BuyerPosition::INIT_SPACE,
        seeds = [b"position", raffle.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub buyer_position: Account<'info, BuyerPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseRaffle<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

#[derive(Accounts)]
pub struct ClaimProceeds<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

#[account]
pub struct Raffle {
    pub seller: Pubkey,
    pub raffle_id: u64,
    pub ticket_price: u64,
    pub max_tickets: u32,
    pub sold_tickets: u32,
    pub title: String,
    pub description: String,
    pub image_url: String,
    pub status: RaffleStatus,
    pub bump: u8,
}

impl Raffle {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // seller
        8 + // raffle_id
        8 + // ticket_price
        4 + // max_tickets
        4 + // sold_tickets
        (4 + MAX_TITLE_LEN) + // title
        (4 + MAX_DESCRIPTION_LEN) + // description
        (4 + MAX_IMAGE_URL_LEN) + // image_url
        1 + // status
        1; // bump
}

#[account]
pub struct BuyerPosition {
    pub raffle: Pubkey,
    pub buyer: Pubkey,
    pub tickets: u32,
    pub spent: u64,
    pub bump: u8,
}

impl BuyerPosition {
    pub const INIT_SPACE: usize = 8 + 32 + 32 + 4 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RaffleStatus {
    Open,
    Closed,
}

#[error_code]
pub enum RaffleError {
    #[msg("Only positive amounts are allowed")]
    InvalidAmount,
    #[msg("Invalid ticket quantity")]
    InvalidTicketQuantity,
    #[msg("Raffle title exceeds max length")]
    TitleTooLong,
    #[msg("Raffle description exceeds max length")]
    DescriptionTooLong,
    #[msg("Image URL exceeds max length")]
    ImageUrlTooLong,
    #[msg("Raffle is closed")]
    RaffleClosed,
    #[msg("No tickets left")]
    SoldOut,
    #[msg("Unauthorized signer or account")]
    Unauthorized,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Math overflow")]
    MathOverflow,
}
