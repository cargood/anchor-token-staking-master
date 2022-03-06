import * as anchor from "@project-serum/anchor";
import { XTokenStake } from "../../target/types/x_token_stake";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  TransactionSignature,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import { Mint } from "./mint";
import { getRewardAddress, getUserAddress, spawnMoney } from "./lib";
import { TokenAccount } from "./token-account";

const VAULT_STAKE_SEED = "x_token_vault_stake";
export class Vault {
  constructor(
    public program: anchor.Program<XTokenStake>,
    public key: PublicKey,
    public mint: Mint,
    public mintAccount: PublicKey,
    public mintCount: number,
    public rewardDuration: number
  ) {}

  async fetch(): Promise<VaultData | null> {
    return (await this.program.account.vault.fetchNullable(
      this.key
    )) as VaultData | null;
  }

  async fetchUser(userAddress: PublicKey): Promise<UserData | null> {
    return (await this.program.account.user.fetchNullable(
      userAddress
    )) as UserData | null;
  }

  static async create({
    authority = Keypair.generate(),
    vaultKey = Keypair.generate(),
    program,
    mint,
    duration,
    stakeTokenCount,
  }: {
    authority?: Keypair;
    vaultKey?: Keypair;
    program: anchor.Program<XTokenStake>;
    mint: Mint;
    duration: number;
    stakeTokenCount: number;
  }): Promise<{
    authority: Keypair;
    vault: Vault;
    sig: TransactionSignature;
  }> {
    await spawnMoney(program, authority.publicKey, 10);

    const [reward, rewardBump] = await getRewardAddress(
      vaultKey.publicKey,
      program
    );

    const mintAccount = await mint.getAssociatedTokenAddress(reward);

    const txSignature = await program.rpc.createVault(
      rewardBump,
      new anchor.BN(duration),
      stakeTokenCount,
      {
        accounts: {
          authority: authority.publicKey,
          vault: vaultKey.publicKey,
          reward,
          rewardMint: mint.key,
          rewardAccount: mintAccount,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedToken: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
        signers: [authority, vaultKey],
        options: {
          commitment: "confirmed",
        },
      }
    );
    return {
      authority,
      vault: new Vault(
        program,
        vaultKey.publicKey,
        mint,
        mintAccount,
        stakeTokenCount,
        duration
      ),
      sig: txSignature,
    };
  }

  async addFunder(
    authority: Keypair,
    funder = Keypair.generate()
  ): Promise<{
    funderAdded: Keypair;
    sig: TransactionSignature;
  }> {
    const txSignature = await this.program.rpc.authorizeFunder(
      funder.publicKey,
      {
        accounts: {
          authority: authority.publicKey,
          vault: this.key,
        },
        signers: [authority],
        options: {
          commitment: "confirmed",
        },
      }
    );
    return {
      funderAdded: funder,
      sig: txSignature,
    };
  }

  async removeFunder(
    authority: Keypair,
    funder: PublicKey
  ): Promise<{
    sig: TransactionSignature;
  }> {
    const txSignature = await this.program.rpc.unauthorizeFunder(funder, {
      accounts: {
        authority: authority.publicKey,
        vault: this.key,
      },
      signers: [authority],
      options: {
        commitment: "confirmed",
      },
    });
    return {
      sig: txSignature,
    };
  }

  async fund({
    authority,
    funder,
    funderAccount,
    amount,
  }: {
    authority: Keypair;
    funder: Keypair;
    funderAccount: PublicKey;
    amount: anchor.BN;
  }): Promise<{
    sig: TransactionSignature;
  }> {
    const txSignature = await this.program.rpc.fund(amount, {
      accounts: {
        funder: funder.publicKey,
        authority: authority.publicKey,
        vault: this.key,
        rewardAccount: this.mintAccount,
        funderAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [funder],
      options: {
        commitment: "confirmed",
      },
    });
    return {
      sig: txSignature,
    };
  }

  async createUser(authority = Keypair.generate()): Promise<{
    authority: Keypair;
    user: PublicKey;
    sig: TransactionSignature;
  }> {
    await spawnMoney(this.program, authority.publicKey, 10);
    const [userAddress, userBump] = await getUserAddress(
      this.key,
      authority.publicKey,
      this.program
    );

    const txSignature = await this.program.rpc.createUser(userBump, {
      accounts: {
        authority: authority.publicKey,
        vault: this.key,
        user: userAddress,
        systemProgram: SystemProgram.programId,
      },
      signers: [authority],
      options: {
        commitment: "confirmed",
      },
    });

    return {
      authority,
      user: userAddress,
      sig: txSignature,
    };
  }

  async closeUser(authority: Keypair, user: PublicKey): Promise<boolean> {
    await this.program.rpc.closeUser({
      accounts: {
        authority: authority.publicKey,
        vault: this.key,
        user,
      },
      signers: [authority],
      options: {
        commitment: "confirmed",
      },
    });
    return true;
  }

  async stake(
    curAuthoriy?: Keypair,
    curUser?: PublicKey
  ): Promise<{
    userAuthority: Keypair;
    user: PublicKey;
    stakeAccount: TokenAccount<PublicKey>;
    stakeMint: Mint;
  }> {
    let userAuthority: Keypair;
    let user: PublicKey;

    if (!curUser) {
      // create user
      const { authority, user: created } = await this.createUser();
      userAuthority = authority;
      user = created;
    } else {
      userAuthority = curAuthoriy;
      user = curUser;
    }

    // create a token to be staked and its account of userAuthority
    const stakeMint = await Mint.create(this.program);
    const stakeAccount = await stakeMint.createAssociatedAccount(
      userAuthority.publicKey
    );
    await stakeMint.mintTokens(stakeAccount, 1);

    // stake
    await this.program.rpc.stake({
      accounts: {
        staker: userAuthority.publicKey,
        vault: this.key,
        stakeAccount: stakeAccount.key,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      signers: [userAuthority],
      options: { commitment: "confirmed" },
    });

    return { userAuthority, user, stakeAccount, stakeMint };
  }

  async unstake(
    authority: Keypair,
    user: PublicKey,
    stakeAccount: TokenAccount<PublicKey>
  ): Promise<boolean> {
    const [vaultPda, vaultStakeBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from(VAULT_STAKE_SEED),
        this.key.toBuffer(),
        authority.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    await this.program.rpc.unstake(vaultStakeBump, {
      accounts: {
        staker: authority.publicKey,
        vault: this.key,
        unstakeAccount: stakeAccount.key,
        vaultPda,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      signers: [authority],
      options: { commitment: "confirmed" },
    });
    return true;
  }

  async claim(vaultAuthority: PublicKey, claimer: Keypair, user: PublicKey) {
    const claimerAccount = await this.mint.getAssociatedTokenAddress(
      claimer.publicKey
    );
    const [reward, _] = await getRewardAddress(this.key, this.program);

    await this.program.rpc.claim({
      accounts: {
        claimer: claimer.publicKey,
        vault: this.key,
        authority: vaultAuthority,
        reward,
        rewardMint: this.mint.key,
        rewardMintAccount: this.mintAccount,
        rewardAccount: claimerAccount,
        user,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      signers: [claimer],
      options: { commitment: "confirmed" },
    });
  }

  async close(
    authority: Keypair,
    refundee: Keypair,
    refundAccount: PublicKey
  ): Promise<boolean> {
    const [reward, _] = await getRewardAddress(this.key, this.program);
    this.program.rpc.closeVault({
      accounts: {
        authority: authority.publicKey,
        vault: this.key,
        reward,
        rewardMint: this.mint.key,
        refundee: refundee.publicKey,
        refundAccount,
        rewardMintAccount: this.mintAccount,
        rent: SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      signers: [authority],
    });
    return true;
  }
}

export type VaultStatus = {
  none?: {};
  initialized?: {};
  paused?: {};
};

export type VaultData = {
  authority: PublicKey;
  status: VaultStatus;
  rewardMint: PublicKey;
  rewardBump: number;
  rewardMintAccount: PublicKey;
  rewardDuration: anchor.BN;
  rewardDurationDeadline: anchor.BN;
  rewardRate: anchor.BN;
  stakedCount: number;
  stakeTokenCount: number;
  userCount: number;
  funders: PublicKey[];
};

export type UserData = {
  vault: PublicKey;
  key: PublicKey;
  rewardEarnedClaimed: anchor.BN;
  rewardEarnedPending: anchor.BN;
  mintStakedCount: number;
  mintAccounts: PublicKey[];
  lastStakeTime: anchor.BN;
};
