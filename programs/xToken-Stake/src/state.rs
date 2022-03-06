use anchor_lang::prelude::*;

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultStatus {
    None,
    Initialized,
    Paused,
}

impl Default for VaultStatus {
    fn default() -> Self {
        Self::None
    }
}

#[account]
#[derive(Default)]
pub struct Vault {
    // authority
    pub authority: Pubkey,
    // state
    pub status: VaultStatus,
    // escrow
    pub reward_seed: u8,
    // reward token
    pub reward_mint: Pubkey,
    // reward token account
    pub reward_mint_account: Pubkey,
    // reward duration
    pub reward_duration: u64,
    // reward duration deadline
    pub reward_duration_deadline: u64,
    // reward rate
    pub reward_rate: u128,
    // number of tokens
    pub stake_token_count: u32,
    // number of tokens staked
    pub staked_count: u32,
    // number of users
    pub user_count: u32,
    // array of funders address
    pub funders: [Pubkey; 5],
}

pub const USER_SIZE: usize = 8 + 32 + 32 + 8 + 8 + 4 + 32 * 300 + 8;

#[account]
#[derive(Default)]
pub struct User {
    // vault
    pub vault: Pubkey,
    // user pub key
    pub key: Pubkey,
    // total amount of reward claimed
    pub reward_earned_claimed: u64,
    // total amount of reward pending
    pub reward_earned_pending: u64,
    // number of mints staked
    pub mint_staked_count: u32,
    // mint_staked
    pub mint_accounts: Vec<Pubkey>,
    // last_stake_time
    pub last_stake_time: u64,
}

#[error]
pub enum ErrorCode {
    #[msg("Duration can not be shorter than 24 hours.")]
    DurationTooShort,
    #[msg("Vault has already been created.")]
    AlreadyCreated,
    #[msg("Owner can not be a funder.")]
    OwnerCanNotBeFunder,
    #[msg("Funder has already been authorized.")]
    FunderAlreadyAuthorized,
    #[msg("Funders are full.")]
    FunderAlreadyFull,
    #[msg("Funder does not exist.")]
    FunderDoesNotExist,
    #[msg("Can not stake now.")]
    CanNotStake,
    #[msg("Already staked account.")]
    AlreadyStakedAccount,
    #[msg("Max stake count reached.")]
    MaxStakeCountReached,
    #[msg("Stake account does not exist.")]
    StakedAccountDoesNotExist,
    #[msg("Vault is not ready")]
    VaultNotReady,
    #[msg("Staked token exists")]
    StakeExist,
    #[msg("Earned pending esists")]
    EarnedPendingExist,
}
