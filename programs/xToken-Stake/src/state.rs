use anchor_lang::prelude::*;

pub const VAULT_SIZE: usize = 8 + 
    32 + // authority
    VaultStatus::SIZE + // status
    32 + // reward_mint
    32 + // reward_account
    4 + // mint_count
    8 + // reward_duration
    4 + // staked_count
    4 + // user_count
    32 * 5; // funders

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VaultStatus {
    None,
    Initialized,
    Paused
}

impl Default for VaultStatus {
    fn default() -> Self {
        Self::None
    }
}

impl VaultStatus {
    pub const SIZE: usize = 1;
}

#[account]
#[derive(Default)]
pub struct Vault {    
    /// authority
    pub authority: Pubkey,
    /// state
    pub status: VaultStatus,
    /// reward token
    pub reward_mint: Pubkey,
    /// reward token account
    pub reward_mint_account: Pubkey,
    /// number of tokens
    pub reward_mint_count: u32,
    /// reward duration
    pub reward_duration: u64,
    /// number of tokens staked
    pub staked_count: u32,
    /// number of users
    pub user_count: u32,
    /// array of funders address
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
    FunderDoesNotExist
}
