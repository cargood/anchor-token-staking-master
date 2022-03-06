use crate::constant::{MAX_MINT_LIMIT, VAULT_STAKE_SEED};
use crate::state::{ErrorCode, VaultStatus};
use crate::state::{User, Vault};
use crate::util::update_rewards;
use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token::TokenAccount;
use spl_token::instruction::AuthorityType::AccountOwner;

#[derive(Accounts)]
pub struct Stake<'info> {
    // authority
    #[account(mut)]
    staker: Signer<'info>,
    // vault
    #[account(mut)]
    vault: Account<'info, Vault>,
    // stake account
    #[account(mut,
    constraint = !user.mint_accounts.iter().any(|x| x == stake_account.to_account_info().key),
    constraint = stake_account.amount > 0
    )]
    stake_account: Box<Account<'info, TokenAccount>>,
    // user
    #[account(mut,
    constraint = user.vault == *vault.to_account_info().key,
    constraint = user.key == *staker.key
    )]
    user: Account<'info, User>,
    // token program
    #[account(address = spl_token::id())]
    token_program: Program<'info, Token>,
    // system program
    system_program: Program<'info, System>,
}

pub fn stake(ctx: Context<Stake>) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    if vault.status != VaultStatus::Initialized {
        return Err(ErrorCode::CanNotStake.into());
    }

    let user = &mut ctx.accounts.user;
    if user.mint_accounts.len() >= MAX_MINT_LIMIT {
        return Err(ErrorCode::MaxStakeCountReached.into());
    }

    // Todo: Check stake account is one of the vault's staked accounts
    // Vault staked accounts should be set ahead and user can stake only one of those a ccounts

    // update
    let stake_account = &mut ctx.accounts.stake_account;

    if user.mint_accounts.iter().any(|x| *x == stake_account.key()) {
        return Err(ErrorCode::AlreadyStakedAccount.into());
    } else {
        update_rewards(vault, user).unwrap();
        user.mint_staked_count = user.mint_staked_count.checked_add(1).unwrap();
        vault.staked_count = vault.staked_count.checked_add(1).unwrap();

        user.mint_accounts.push(stake_account.key());

        // transfer token authority
        let (vault_pda, _vault_bump) = Pubkey::find_program_address(
            &[
                VAULT_STAKE_SEED.as_bytes(),
                vault.key().as_ref(),
                ctx.accounts.staker.key().as_ref(),
            ],
            ctx.program_id,
        );

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::SetAuthority {
                current_authority: ctx.accounts.staker.to_account_info().clone(),
                account_or_mint: stake_account.to_account_info().clone(),
            },
        );

        anchor_spl::token::set_authority(cpi_context, AccountOwner, Some(vault_pda))?;
    }

    Ok(())
}
