use crate::constant::{MIN_DURATION, VAULT_REWARD_SEED};
use crate::state::{ErrorCode, Vault, VaultStatus};

use anchor_lang::prelude::*;
use anchor_spl::associated_token::{create, AssociatedToken, Create};
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(reward_bump: u8)]
pub struct CreateVault<'info> {
    // the vault athority
    #[account(mut)]
    authority: Signer<'info>,

    // vault account to be created
    #[account(init, payer=authority)]
    vault: Account<'info, Vault>,

    // reward pda account
    #[account(seeds = [VAULT_REWARD_SEED.as_bytes(), vault.key().as_ref()], bump = reward_bump)]
    reward: SystemAccount<'info>,

    // reward token
    reward_mint: AccountInfo<'info>,

    // reward token account to be created, owned by vault
    #[account(mut)]
    reward_account: UncheckedAccount<'info>,

    rent: Sysvar<'info, Rent>,

    #[account(address = anchor_spl::associated_token::ID)]
    associated_token: Program<'info, AssociatedToken>,

    #[account(address = spl_token::id())]
    token_program: Program<'info, Token>,

    system_program: Program<'info, System>,
}

pub fn create_vault(
    ctx: Context<CreateVault>,
    reward_bump: u8,
    reward_duration: u64,
    stake_token_count: u32,
) -> ProgramResult {
    // check reward_duration
    if reward_duration < MIN_DURATION {
        return Err(ErrorCode::DurationTooShort.into());
    }

    // set vault
    let vault = &mut ctx.accounts.vault;

    // check vault status
    if vault.status != VaultStatus::None {
        return Err(ErrorCode::AlreadyCreated.into());
    }

    // create reward_account
    if ctx.accounts.reward.owner == &System::id() {
        let cpi_context = Create {
            payer: ctx.accounts.authority.to_account_info(),
            associated_token: ctx.accounts.reward_account.to_account_info(),
            authority: ctx.accounts.reward.to_account_info(),
            mint: ctx.accounts.reward_mint.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let create_ctx =
            CpiContext::new(ctx.accounts.associated_token.to_account_info(), cpi_context);
        create(create_ctx)?;
    }

    vault.authority = *ctx.accounts.authority.key;
    vault.reward_mint = *ctx.accounts.reward_mint.to_account_info().key;
    vault.reward_mint_account = ctx.accounts.reward_account.key();
    vault.stake_token_count = stake_token_count;
    vault.reward_duration = reward_duration;
    vault.reward_bump = reward_bump;
    vault.status = VaultStatus::Initialized;
    vault.staked_count = 0;
    vault.user_count = 0;

    Ok(())
}
