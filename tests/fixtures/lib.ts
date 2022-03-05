import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../../target/types/x_token_stake";
import { Mint } from "./mint";
import { Vault } from "./vault";
import { Keypair } from "@solana/web3.js";

const VAULT_REWARD_SEED = "x_token_vault_reward";
const VAULT_USER_SEED = "x_token_vault_user";

function toPublicKey<T extends anchor.web3.PublicKey | anchor.web3.Keypair>(
  val: T
): anchor.web3.PublicKey {
  if ("publicKey" in val) {
    return val.publicKey;
  } else {
    return val;
  }
}

async function getRewardAddress(
  source: anchor.web3.PublicKey,
  program: Program<XTokenStake>
): Promise<[anchor.web3.PublicKey, number]> {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(VAULT_REWARD_SEED), source.toBuffer()],
    program.programId
  );
}

async function getUserAddress(
  vault: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey,
  program: Program<XTokenStake>
): Promise<[anchor.web3.PublicKey, number]> {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(VAULT_USER_SEED), vault.toBuffer(), authority.toBuffer()],
    program.programId
  );
}

async function spawnMoney(
  program: anchor.Program<XTokenStake>,
  to: anchor.web3.PublicKey,
  sol: number
): Promise<anchor.web3.TransactionSignature> {
  const lamports = sol * anchor.web3.LAMPORTS_PER_SOL;
  const transaction = new anchor.web3.Transaction();
  transaction.add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: program.provider.wallet.publicKey,
      lamports,
      toPubkey: to,
    })
  );
  return await program.provider.send(transaction, [], {
    commitment: "confirmed",
  });
}

async function createVault(program: Program<XTokenStake>): Promise<{
  mint: Mint;
  authority: Keypair;
  vault: Vault;
}> {
  // create reward token
  const mint = await Mint.create(program);

  // create vault
  const { authority, vault } = await Vault.create({
    program,
    mint,
    duration: 128,
    stakeTokenCount: 500000,
  });

  return {
    mint,
    authority,
    vault,
  };
}

export {
  toPublicKey,
  getRewardAddress,
  getUserAddress,
  spawnMoney,
  createVault,
};
