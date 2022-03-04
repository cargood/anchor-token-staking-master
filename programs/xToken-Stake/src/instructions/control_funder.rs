use crate::state::{ErrorCode, Vault, VaultStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ControlFunder<'info> {
    #[account(signer)]
    authority: AccountInfo<'info>,

    #[account(mut,
    has_one=authority,
    constraint = vault.status == VaultStatus::Initialized)]
    vault: Account<'info, Vault>,
}

pub fn authorize_funder(ctx: Context<ControlFunder>, funder: Pubkey) -> ProgramResult {
    // owner can not be a funder
    if funder == ctx.accounts.vault.authority {
        return Err(ErrorCode::OwnerCanNotBeFunder.into());
    }

    let funders = &mut ctx.accounts.vault.funders;
    if funders.iter().any(|x| *x == funder) {
        return Err(ErrorCode::FunderAlreadyAuthorized.into());
    }

    if let Some(idx) = funders.iter().position(|x| *x == Pubkey::default()) {
        funders[idx] = funder;
    } else {
        return Err(ErrorCode::FunderAlreadyFull.into());
    }
    Ok(())
}

pub fn unauthorize_funder(ctx: Context<ControlFunder>, funder: Pubkey) -> ProgramResult {
    let funders = &mut ctx.accounts.vault.funders;
    if let Some(idx) = funders.iter().position(|x| *x == funder) {
        funders[idx] = Pubkey::default();
    } else {
        return Err(ErrorCode::FunderDoesNotExist.into());
    }
    Ok(())
}
