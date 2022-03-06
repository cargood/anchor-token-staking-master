use crate::constant::VAULT_REWARD_SEED;
use crate::state::{Vault, VaultStatus};
use crate::util::get_now_timestamp;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::{create, AssociatedToken, Create};
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct CloseVault<'info> {
    // authority
    #[account(mut)]
    authority: Signer<'info>,

    // vault
    #[account(mut,
    close = refundee,
    has_one = authority,
    has_one = reward_mint_account,
    has_one = reward_mint,
    constraint = vault.status == VaultStatus::Initialized,
    constraint = vault.user_count == 0,
    constraint = vault.reward_duration_deadline > 0,
    constraint = vault.reward_duration_deadline < get_now_timestamp(),
    constraint = vault.staked_count == 0,
    )]
    vault: Account<'info, Vault>,

    // reward account
    #[account(mut,
        seeds = [VAULT_REWARD_SEED.as_bytes(), vault.to_account_info().key.as_ref()], bump = vault.reward_bump)]
    reward: SystemAccount<'info>,

    // reward mint token
    reward_mint: AccountInfo<'info>,

    #[account(mut)]
    refundee: AccountInfo<'info>,

    #[account(mut)]
    refund_account: AccountInfo<'info>,

    #[account(mut)]
    reward_mint_account: Box<Account<'info, TokenAccount>>,

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

pub fn close_vault(ctx: Context<CloseVault>) -> ProgramResult {
    let vault = &mut ctx.accounts.vault;
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
    if ctx.accounts.refund_account.owner == &System::id() {
        let cpi_context = Create {
            payer: ctx.accounts.authority.to_account_info(),
            associated_token: ctx.accounts.refund_account.to_account_info(),
            authority: ctx.accounts.refundee.to_account_info(),
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

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        anchor_spl::token::Transfer {
            from: ctx.accounts.reward_mint_account.to_account_info().clone(),
            to: ctx.accounts.refund_account.to_account_info().clone(),
            authority: ctx.accounts.reward.to_account_info().clone(),
        },
    );

    anchor_spl::token::transfer(
        cpi_ctx.with_signer(&[&seeds[..]]),
        ctx.accounts.reward_mint_account.amount,
    )?;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info().clone(),
        anchor_spl::token::CloseAccount {
            account: ctx.accounts.reward_mint_account.to_account_info().clone(),
            destination: ctx.accounts.refundee.to_account_info().clone(),
            authority: ctx.accounts.reward.to_account_info().clone(),
        },
    );

    anchor_spl::token::close_account(cpi_ctx.with_signer(&[&seeds[..]]))?;
    Ok(())
}
