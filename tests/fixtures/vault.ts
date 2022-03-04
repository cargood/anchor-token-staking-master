import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../../target/types/x_token_stake";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  TransactionSignature,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";

const VAULT_SEED = "x_token_vault";

export class Vault {
  constructor(
    public program: anchor.Program<XTokenStake>,
    public key: PublicKey,
    public mint: PublicKey,
    public mintCount: number,
    public rewardDuration: number
  ) {}

  async fetch(): Promise<VaultData | null> {
    return (await this.program.account.vault.fetchNullable(
      this.key
    )) as VaultData | null;
  }

  static async getRewardBumpResult(
    vault: PublicKey,
    authority: PublicKey,
    mint: PublicKey,
    program: Program<XTokenStake>
  ): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from(VAULT_SEED),
        vault.toBuffer(),
        authority.toBuffer(),
        mint.toBuffer(),
      ],
      program.programId
    );
  }

  static async create({
    vaultKey = Keypair.generate(),
    program,
    mint,
    duration,
    mintCount,
  }: {
    vaultKey?: Keypair;
    program: anchor.Program<XTokenStake>;
    mint: PublicKey;
    duration: number;
    mintCount: number;
  }): Promise<{
    vault: Vault;
    sig: TransactionSignature;
  }> {
    const [rewardMintAccount, rewardBump] = await this.getRewardBumpResult(
      vaultKey.publicKey,
      program.provider.wallet.publicKey,
      mint,
      program
    );
    const txSignature = await program.rpc.createVault(
      rewardBump,
      new anchor.BN(duration),
      mintCount,
      {
        accounts: {
          authority: program.provider.wallet.publicKey,
          vault: vaultKey.publicKey,
          rewardMint: mint,
          rewardAccount: rewardMintAccount,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
        signers: [vaultKey],
        options: {
          commitment: "confirmed",
        },
      }
    );
    return {
      vault: new Vault(program, vaultKey.publicKey, mint, mintCount, duration),
      sig: txSignature,
    };
  }

  async addFunder(funder = Keypair.generate().publicKey): Promise<{
    funderAdded: PublicKey;
    sig: TransactionSignature;
  }> {
    const txSignature = await this.program.rpc.authorizeFunder(funder, {
      accounts: {
        authority: this.program.provider.wallet.publicKey,
        vault: this.key,
      },
      signers: [],
      options: {
        commitment: "confirmed",
      },
    });
    return {
      funderAdded: funder,
      sig: txSignature,
    };
  }

  async removeFunder(funder: PublicKey): Promise<{
    sig: TransactionSignature;
  }> {
    const txSignature = await this.program.rpc.unauthorizeFunder(funder, {
      accounts: {
        authority: this.program.provider.wallet.publicKey,
        vault: this.key,
      },
      signers: [],
      options: {
        commitment: "confirmed",
      },
    });
    return {
      sig: txSignature,
    };
  }
}

export type VaultStatus = {
  none?: {};
  initialized?: {};
  paused?: {};
};

type VaultData = {
  authority: PublicKey;
  status: VaultStatus;
  rewardMint: PublicKey;
  rewardMintAccount: PublicKey;
  rewardMintCount: number;
  rewardDuration: anchor.BN;
  stakedCount: number;
  userCount: number;
  funders: PublicKey[];
};
