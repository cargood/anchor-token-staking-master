import * as anchor from "@project-serum/anchor";
import { Mint } from "./mint";
import { XTokenStake } from "../../target/types/x_token_stake";

export class TokenAccount<
  T extends anchor.web3.PublicKey | anchor.web3.Keypair
> {
  constructor(
    public program: anchor.Program<XTokenStake>,
    public key: anchor.web3.PublicKey,
    public mint: Mint,
    public owner: T
  ) {}
}
