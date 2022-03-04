mod constant;
mod instructions;
mod state;

use anchor_lang::prelude::*;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod x_token_stake {
    use super::*;
    pub fn create_vault(
        ctx: Context<CreateVault>,
        reward_bump: u8,
        reward_duration: u64,
        mint_count: u32,
    ) -> ProgramResult {
        create_vault::create_vault(ctx, reward_bump, reward_duration, mint_count)
    }

    pub fn authorize_funder(ctx: Context<ControlFunder>, funder: Pubkey) -> ProgramResult {
        control_funder::authorize_funder(ctx, funder)
    }

    pub fn unauthorize_funder(ctx: Context<ControlFunder>, funder: Pubkey) -> ProgramResult {
        control_funder::unauthorize_funder(ctx, funder)
    }
}
