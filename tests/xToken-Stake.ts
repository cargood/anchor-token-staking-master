import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../target/types/x_token_stake";
import { Mint } from "./fixtures/mint";
import { Vault } from "./fixtures/vault";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("xToken-Stake", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.XTokenStake as Program<XTokenStake>;

  it("Create Vault", async () => {
    // create reward token
    const mint = await Mint.create(program);

    // create vault
    const { vault, sig } = await Vault.create({
      program,
      mint: mint.key,
      duration: 30,
      mintCount: 500000,
    });

    // fetch vault data
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
    expect(vaultData.funders.length).to.equal(5);
    expect(vaultData.status.initialized !== null).to.be.true;
  });

  it("Authorize and Unauthorize Funder", async () => {
    // create reward token
    const mint = await Mint.create(program);

    // create vault
    const { vault } = await Vault.create({
      program,
      mint: mint.key,
      duration: 30,
      mintCount: 500000,
    });

    // add funder
    const { funderAdded } = await vault.addFunder();

    // fetch vault data
    let vaultData = await vault.fetch();

    // check added funder
    expect(vaultData.funders[0].toString()).to.equal(funderAdded.toString());

    // remove funder
    await vault.removeFunder(funderAdded);

    // fetch vault data
    vaultData = await vault.fetch();

    // check removed funder
    expect(vaultData.funders[0].toString()).to.equal(
      PublicKey.default.toString()
    );
  });
});
