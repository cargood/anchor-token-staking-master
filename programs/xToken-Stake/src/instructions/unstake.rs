use crate::constant::VAULT_STAKE_SEED;
use crate::state::{ErrorCode, VaultStatus};
use crate::state::{User, Vault};
use crate::util::update_rewards;
use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token::TokenAccount;
use spl_token::instruction::AuthorityType::AccountOwner;

#[derive(Accounts)]
#[instruction(vault_stake_bump: u8)]
pub struct Unstake<'info> {
    // authority
    #[account(mut)]
    staker: Signer<'info>,
    // vault
    #[account(mut)]
    vault: Account<'info, Vault>,
    // stake account
    #[account(mut,
    constraint = user.mint_accounts.iter().any(|x| x == unstake_account.to_account_info().key),
    constraint = unstake_account.amount > 0
    )]
    unstake_account: Box<Account<'info, TokenAccount>>,
    // vault pda
    #[account(mut,
    seeds = [VAULT_STAKE_SEED.as_bytes(), vault.key().as_ref(), staker.key().as_ref()], bump = vault_stake_bump
    )]
    vault_pda: AccountInfo<'info>,
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

pub fn unstake(ctx: Context<Unstake>, _vault_stake_bump: u8) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
    if vault.status != VaultStatus::Initialized {
        return Err(ErrorCode::CanNotStake.into());
    }

    // update
    let user = &mut ctx.accounts.user;
    let unstake_account = &mut ctx.accounts.unstake_account;

    if !user
        .mint_accounts
        .iter()
        .any(|x| *x == unstake_account.key())
    {
        return Err(ErrorCode::StakedAccountDoesNotExist.into());
    } else {
        update_rewards(vault, user).unwrap();
        user.mint_staked_count = user.mint_staked_count.checked_sub(1).unwrap();
        vault.staked_count = vault.staked_count.checked_sub(1).unwrap();

        let index = user
            .mint_accounts
            .iter()
            .position(|x| *x == unstake_account.key());
        if let Some(existed) = index {
            user.mint_accounts.remove(existed);
        }

        // transfer token authority
        let vault_address = vault.key().clone();
        let staker_address = ctx.accounts.staker.key().clone();

        let (_vault_pda, vault_bump) = Pubkey::find_program_address(
            &[
                VAULT_STAKE_SEED.as_bytes(),
                vault_address.as_ref(),
                staker_address.as_ref(),
            ],
            ctx.program_id,
        );

        let seeds = &[
            VAULT_STAKE_SEED.as_bytes(),
            vault_address.as_ref(),
            staker_address.as_ref(),
            &[vault_bump],
        ]; // need this to sign the pda, match the authority

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::SetAuthority {
                current_authority: ctx.accounts.vault_pda.to_account_info().clone(),
                account_or_mint: unstake_account.to_account_info().clone(),
            },
        );

        anchor_spl::token::set_authority(
            cpi_context.with_signer(&[&seeds[..]]),
            AccountOwner,
            Some(ctx.accounts.staker.key()),
        )?;
    }

    Ok(())
}
