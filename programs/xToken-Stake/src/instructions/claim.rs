use crate::constant::{MIN_DURATION, VAULT_REWARD_SEED};
use crate::state::{ErrorCode, User, Vault, VaultStatus};
use crate::util::update_rewards;

use anchor_lang::prelude::*;
use anchor_spl::associated_token::{create, AssociatedToken, Create};
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct Claim<'info> {
    // claimer
    #[account(mut)]
    claimer: Signer<'info>,
    // vault
    #[account(mut,
    has_one = authority,
    has_one = reward_mint_account,
    constraint = vault.status == VaultStatus::Initialized)]
    vault: Account<'info, Vault>,
    // vault owner
    authority: AccountInfo<'info>,
    // vault reward account
    reward_mint_account: Account<'info, TokenAccount>,
    // claimer reward account
    reward_account: Account<'info, TokenAccount>,
    // user
    #[account(mut,
    constraint = user.vault == *vault.to_account_info().key,
    constraint = user.key == *claimer.key)]
    user: Account<'info, User>,
    // token program
    #[account(address = spl_token::id())]
    token_program: Program<'info, Token>,
}

pub fn claim(ctx: Context<Claim>) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    if vault.status != VaultStatus::Initialized {
        return Err(ErrorCode::VaultNotReady.into());
    }

    let user = &mut ctx.accounts.user;
    update_rewards(vault, user).unwrap();

    if user.reward_earned_pending > 0 {
        let mut reward_amount = user.reward_earned_claimed;
        let vault_current_amount = ctx.accounts.reward_mint_account.amount;

        if vault_current_amount < reward_amount {
            reward_amount = vault_current_amount;
        }

        if reward_amount > 0 {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.reward_mint_account.to_account_info().clone(),
                    to: ctx.accounts.reward_account.to_account_info().clone(),
                    authority: vault.to_account_info().clone(),
                },
            );
            anchor_spl::token::transfer(cpi_ctx, reward_amount)?;

            // update reward claiming vaules
            user.reward_earned_pending
                .checked_sub(reward_amount)
                .unwrap();
            user.reward_earned_claimed
                .checked_add(reward_amount)
                .unwrap();
        }
    }
    Ok(())
}
