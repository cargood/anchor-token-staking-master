use crate::constant::VAULT_USER_SEED;
use crate::state::{User, Vault, VaultStatus};

use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(user_bump: u8)]
pub struct CreateUser<'info> {
    // authority
    #[account(mut)]
    authority: Signer<'info>,

    // vault
    #[account(mut,
    constraint = vault.status == VaultStatus::Initialized)]
    vault: Account<'info, Vault>,

    // user
    #[account(init,
    payer = authority,
    seeds = [
        VAULT_USER_SEED.as_bytes(), vault.to_account_info().key.as_ref(), authority.key.as_ref()
    ],
    bump = user_bump)]
    user: Account<'info, User>,

    system_program: Program<'info, System>,
}

pub fn create_user(ctx: Context<CreateUser>, _user_bump: u8) -> ProgramResult {
    let user = &mut ctx.accounts.user;
    user.vault = *ctx.accounts.vault.to_account_info().key;
    user.key = *ctx.accounts.authority.key;
    user.reward_earned_claimed = 0;
    user.reward_earned_pending = 0;
    user.min_staked_count = 0;
    user.mint_accounts = vec![];

    let vault = &mut ctx.accounts.vault;
    vault.user_count = vault.user_count.checked_add(1).unwrap();

    Ok(())
}
