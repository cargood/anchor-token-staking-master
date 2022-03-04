import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../../target/types/x_token_stake";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const VAULT_SEED = "x_token_vault";

export class Vault {
  constructor(
    public program: anchor.Program<XTokenStake>,
    public key: anchor.web3.PublicKey,
    public mint: anchor.web3.PublicKey,
    public mintCount: number,
    public rewardDuration: number
  ) {}

  async fetch(): Promise<VaultData | null> {
    return (await this.program.account.vault.fetchNullable(
      this.key
    )) as VaultData | null;
  }

  static async getRewardBumpResult(
    vault: anchor.web3.PublicKey,
    authority: anchor.web3.PublicKey,
    mint: anchor.web3.PublicKey,
    program: Program<XTokenStake>
  ): Promise<[anchor.web3.PublicKey, number]> {
    return await anchor.web3.PublicKey.findProgramAddress(
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
    vaultKey = anchor.web3.Keypair.generate(),
    program,
    mint,
    duration,
    mintCount,
  }: {
    vaultKey?: anchor.web3.Keypair;
    program: anchor.Program<XTokenStake>;
    mint: anchor.web3.PublicKey;
    duration: number;
    mintCount: number;
  }): Promise<{
    vault: Vault;
    sig: anchor.web3.TransactionSignature;
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
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
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
}

export type VaultStatus = {
  none?: {};
  initialized?: {};
  paused?: {};
};

type VaultData = {
  authority: anchor.web3.PublicKey;
  status: VaultStatus;
  rewardMint: anchor.web3.PublicKey;
  rewardMintAccount: anchor.web3.PublicKey;
  rewardMintCount: number;
  rewardDuration: anchor.BN;
  stakedCount: number;
  userCount: number;
  funders: anchor.web3.PublicKey[];
};
