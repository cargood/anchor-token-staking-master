use crate::constant::{MIN_DURATION, VAULT_SEED};
use crate::state::{ErrorCode, Vault, VaultStatus};

use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
#[instruction(reward_bump: u8)]
pub struct CreateVault<'info> {
    // the vault athority
    #[account(mut, signer)]
    authority: AccountInfo<'info>,

    // vault account to be created
    #[account(init, payer=authority)]
    vault: Account<'info, Vault>,

    // reward token
    reward_mint: AccountInfo<'info>,

    // reward token account to be created, owned by vault
    #[account(
        init,
        token::mint = reward_mint,
        token::authority = vault,
        seeds = [
            VAULT_SEED.as_bytes(), vault.key().as_ref(), authority.key.as_ref(), reward_mint.key.as_ref()
        ],
        bump=reward_bump,
        payer=authority
    )]
    reward_account: Box<Account<'info, TokenAccount>>,

    rent: Sysvar<'info, Rent>,

    #[account(address = spl_token::id())]
    token_program: AccountInfo<'info>,
    system_program: Program<'info, System>,
}

pub fn create_vault(
    ctx: Context<CreateVault>,
    _reward_bump: u8,
    reward_duration: u64,
    mint_count: u32,
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

    vault.authority = *ctx.accounts.authority.key;
    vault.reward_mint = *ctx.accounts.reward_mint.to_account_info().key;
    vault.reward_mint_account = ctx.accounts.reward_account.key();
    vault.reward_mint_count = mint_count;
    vault.reward_duration = reward_duration;
    vault.status = VaultStatus::Initialized;
    vault.staked_count = 0;
    vault.user_count = 0;

    Ok(())
}
