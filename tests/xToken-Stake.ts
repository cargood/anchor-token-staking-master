import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../target/types/x_token_stake";
import { Mint } from "./fixtures/mint";
import { Vault, VaultStatus } from "./fixtures/vault";
import { expect } from "chai";

describe("xToken-Stake", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.XTokenStake as Program<XTokenStake>;

  it("Is initialized!", async () => {
    // Add your test here.
    const mint = await Mint.create(program);

    const { vault, sig } = await Vault.create({
      program,
      mint: mint.key,
      duration: 30,
      mintCount: 500000,
    });

    console.log("Your transaction signature", sig);

    const vaultData = await vault.fetch();

    // get vault pda
    const [rewardMintAccount, rewardBump] = await Vault.getRewardBumpResult(
      vault.key,
      program.provider.wallet.publicKey,
      mint.key,
      program
    );

    // check the result
    expect(vaultData.rewardDuration.toNumber()).to.equal(30);
    expect(vaultData.rewardMintCount).to.equal(500000);
    expect(vaultData.rewardMintAccount.toString()).to.equal(
      rewardMintAccount.toString()
    );
    expect(vaultData.status.initialized !== null).to.be.true;
  });
});
