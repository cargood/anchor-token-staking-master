use crate::constant::CALC_PRECISION;
use crate::state::{User, Vault};
use anchor_lang::{prelude::*, solana_program::clock};
use std::convert::TryInto;

pub fn get_now_timestamp() -> u64 {
    return clock::Clock::get()
        .unwrap()
        .unix_timestamp
        .try_into()
        .unwrap();
}

pub fn earned(
    elapsed_time: u64,
    balance_staked: u32,
    reward_rate_per_token: u128,
    user_reward_per_token_pending: u64,
) -> u64 {
    let earned = (reward_rate_per_token as u128)
        .checked_div(CALC_PRECISION)
        .unwrap()
        .checked_mul(balance_staked as u128)
        .unwrap()
        .checked_mul(elapsed_time as u128)
        .unwrap()
        .checked_add(user_reward_per_token_pending as u128)
        .unwrap()
        .try_into()
        .unwrap();
    return earned;
}

pub fn update_rewards(vault: &mut Account<Vault>, user: &mut Account<User>) -> ProgramResult {
    let now = get_now_timestamp();

    // calculate time elapsed since last update
    let time_diff = std::cmp::max(now - user.last_stake_time, 0 as u64);
    // update user reward to pass it to pending reward

    user.reward_earned_pending = earned(
        time_diff,
        user.mint_staked_count,
        vault.reward_rate,
        user.reward_earned_pending,
    );
    // update time in user account
    user.last_stake_time = now;

    Ok(())
}
