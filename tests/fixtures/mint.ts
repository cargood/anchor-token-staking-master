import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../../target/types/x_token_stake";
import { toPublicKey } from "./lib";
import { TokenAccount } from "./token-account";

import {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

class Mint {
  constructor(
    public key: anchor.web3.PublicKey,
    public authority: anchor.web3.Keypair,
    public program: Program<XTokenStake>
  ) {}

  static async create(
    program: Program<XTokenStake>,
    authority: anchor.web3.Keypair = anchor.web3.Keypair.generate(),
    mint: anchor.web3.Keypair = anchor.web3.Keypair.generate(),
    freezeAuthority: anchor.web3.PublicKey | null = null
  ): Promise<Mint> {
    const instructions = [
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: await Token.getMinBalanceRentForExemptMint(
          program.provider.connection
        ),
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      // initializes mint account
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        mint.publicKey,
        0, // number
        authority.publicKey, // mint authority
        freezeAuthority // freeze authority
      ),
    ];
    const transaction = new anchor.web3.Transaction();
    transaction.add(...instructions);
    await program.provider.send(transaction, [mint], {
      commitment: "confirmed",
    });
    return new Mint(mint.publicKey, authority, program);
  }

  async mintTokens<T extends anchor.web3.PublicKey | anchor.web3.Keypair>(
    to: TokenAccount<T>,
    amount: number
  ) {
    const transaction = new anchor.web3.Transaction();
    transaction.add(
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        this.key,
        to.key,
        this.authority.publicKey,
        [],
        amount
      )
    );
    await this.program.provider.send(transaction, [this.authority], {
      commitment: "confirmed",
    });
  }

  async getAssociatedTokenAddress<
    T extends anchor.web3.PublicKey | anchor.web3.Keypair
  >(owner: T): Promise<anchor.web3.PublicKey> {
    return await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      this.key,
      toPublicKey(owner),
      true
    );
  }

  async createAssociatedAccount<
    T extends anchor.web3.PublicKey | anchor.web3.Keypair
  >(owner: T): Promise<TokenAccount<T>> {
    const tokenAccount = await this.getAssociatedTokenAddress(owner);
    const transaction = new anchor.web3.Transaction();
    transaction.add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        this.key,
        tokenAccount,
        toPublicKey(owner),
        this.program.provider.wallet.publicKey
      )
    );
    await this.program.provider.send(transaction, [], {
      commitment: "confirmed",
    });
    return new TokenAccount(this.program, tokenAccount, this, owner);
  }
}

const MINT_SIZE = 4 + 32 + 8 + 1 + 1 + 4 + 32;

export { Mint, MINT_SIZE };
