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
    // number of tokens
    pub reward_mint_count: u32,
    // reward duration
    pub reward_duration: u64,
    // reward duration deadline
    pub reward_duration_deadline: u64,
    // reward rate
    pub reward_rate: u128,
    // number of tokens staked
    pub staked_count: u32,
    // number of users
    pub user_count: u32,
    // array of funders address
    pub funders: [Pubkey; 5],
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
}
