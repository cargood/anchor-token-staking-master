mod constant;
mod instructions;
mod state;
mod util;

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
        stake_token_count: u32,
    ) -> ProgramResult {
        create_vault::create_vault(ctx, reward_bump, reward_duration, stake_token_count)
    }

    pub fn authorize_funder(ctx: Context<ControlFunder>, funder: Pubkey) -> ProgramResult {
        control_funder::authorize_funder(ctx, funder)
    }

    pub fn unauthorize_funder(ctx: Context<ControlFunder>, funder: Pubkey) -> ProgramResult {
        control_funder::unauthorize_funder(ctx, funder)
    }

    pub fn fund(ctx: Context<Fund>, amount: u64) -> ProgramResult {
        fund::fund(ctx, amount)
    }

    pub fn create_user(ctx: Context<CreateUser>, user_bump: u8) -> ProgramResult {
        create_user::create_user(ctx, user_bump)
    }

    pub fn stake(ctx: Context<Stake>) -> ProgramResult {
        stake::stake(ctx)
    }
}
