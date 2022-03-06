use crate::constant::VAULT_REWARD_SEED;
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
    has_one = reward_mint,
    constraint = vault.status == VaultStatus::Initialized)]
    vault: Account<'info, Vault>,

    // vault owner
    authority: AccountInfo<'info>,

    // reward pda account
    reward: AccountInfo<'info>,

    // reward mint
    reward_mint: AccountInfo<'info>,

    // vault reward account
    #[account(mut,
    constraint = reward_mint_account.mint == reward_mint.key())]
    reward_mint_account: Box<Account<'info, TokenAccount>>,

    // claimer reward account
    #[account(mut)]
    reward_account: AccountInfo<'info>,

    // user
    #[account(mut,
    constraint = user.vault == *vault.to_account_info().key,
    constraint = user.key == *claimer.key)]
    user: Account<'info, User>,

    // associated token program
    #[account(address = anchor_spl::associated_token::ID)]
    associated_token_program: Program<'info, AssociatedToken>,

    // rent
    rent: Sysvar<'info, Rent>,

    // token program
    #[account(address = spl_token::id())]
    token_program: Program<'info, Token>,

    // system program
    system_program: Program<'info, System>,
}

pub fn claim(ctx: Context<Claim>) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    if vault.status != VaultStatus::Initialized {
        return Err(ErrorCode::VaultNotReady.into());
    }

    let user = &mut ctx.accounts.user;
    update_rewards(vault, user).unwrap();

    if user.reward_earned_pending > 0 {
        let mut reward_amount = user.reward_earned_pending;
        let vault_current_amount = ctx.accounts.reward_mint_account.amount;

        if vault_current_amount < reward_amount {
            reward_amount = vault_current_amount;
        }

        if reward_amount > 0 {
            // check claimer token account exists
            if ctx.accounts.reward_account.owner == &System::id() {
                let cpi_context = Create {
                    payer: ctx.accounts.claimer.to_account_info(),
                    associated_token: ctx.accounts.reward_account.to_account_info(),
                    authority: ctx.accounts.claimer.to_account_info(),
                    mint: ctx.accounts.reward_mint.clone(),
                    rent: ctx.accounts.rent.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                };
                let create_ctx = CpiContext::new(
                    ctx.accounts.associated_token_program.to_account_info(),
                    cpi_context,
                );
                create(create_ctx)?;
            }

            let vault_address = vault.key().clone();
            let (_vault_pda, vault_bump) = Pubkey::find_program_address(
                &[VAULT_REWARD_SEED.as_bytes(), vault_address.as_ref()],
                ctx.program_id,
            );
            let seeds = &[
                VAULT_REWARD_SEED.as_bytes(),
                vault_address.as_ref(),
                &[vault_bump],
            ];

            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.reward_mint_account.to_account_info().clone(),
                    to: ctx.accounts.reward_account.to_account_info().clone(),
                    authority: ctx.accounts.reward.to_account_info().clone(),
                },
            );
            anchor_spl::token::transfer(cpi_ctx.with_signer(&[&seeds[..]]), reward_amount)?;

            // update reward claiming vaules
            user.reward_earned_pending = user
                .reward_earned_pending
                .checked_sub(reward_amount)
                .unwrap();
            user.reward_earned_claimed = user
                .reward_earned_claimed
                .checked_add(reward_amount)
                .unwrap();
        }
    }
    Ok(())
}
