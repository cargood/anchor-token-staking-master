import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../target/types/x_token_stake";
import { Mint } from "./fixtures/mint";
import { expect } from "chai";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createVault, sleep } from "./fixtures/lib";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("xToken-Stake", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.XTokenStake as Program<XTokenStake>;

  xit("Create Vault", async () => {
    const { vault } = await createVault(program);

    // fetch vault data
    const vaultData = await vault.fetch();

    // check the result
    expect(vaultData.rewardDuration.toNumber()).to.equal(128);
    expect(vaultData.stakeTokenCount).to.equal(500000);
    expect(vaultData.rewardMintAccount.toString()).to.equal(
      vault.mintAccount.toString()
    );
    expect(vaultData.funders.length).to.equal(5);
    expect(vaultData.status.initialized !== null).to.be.true;
  });

  xit("Authorize and Unauthorize Funder", async () => {
    const { authority, vault } = await createVault(program);

    // add funder
    const { funderAdded } = await vault.addFunder(authority);

    // fetch vault data
    let vaultData = await vault.fetch();

    // check added funder
    expect(vaultData.funders[0].toString()).to.equal(
      funderAdded.publicKey.toString()
    );

    // remove funder
    await vault.removeFunder(authority, funderAdded.publicKey);

    // fetch vault data
    vaultData = await vault.fetch();

    // check removed funder
    expect(vaultData.funders[0].toString()).to.equal(
      PublicKey.default.toString()
    );
  });

  xit("Fund Amount", async () => {
    const { mint, authority, vault } = await createVault(program);

    // add funder
    const { funderAdded } = await vault.addFunder(authority);
    const funderTokenAccount = await mint.createAssociatedAccount(
      funderAdded.publicKey
    );

    const amount = new anchor.BN("1000000");
    await mint.mintTokens(funderTokenAccount, amount.toNumber());

    // fund
    await vault.fund({
      authority,
      funder: funderAdded,
      funderAccount: funderTokenAccount.key,
      amount: new anchor.BN("1000000"),
    });

    let vaultData = await vault.fetch();

    const rightSide = "1".padEnd(66, "0");
    expect(vaultData.rewardRate.toString()).to.equal(
      new anchor.BN(rightSide, 2).toString()
    );
  });

  xit("Create User", async () => {
    const { vault } = await createVault(program);

    // create user
    const { authority: userAuthority, user } = await vault.createUser();

    const userData = await vault.fetchUser(user);
    const vaultData = await vault.fetch();

    expect(vaultData.userCount).to.equal(1);
    expect(userData.vault.toString()).to.equal(vault.key.toString());
    expect(userData.mintAccounts.length).to.equal(0);
    expect(userData.key.toString()).to.equal(
      userAuthority.publicKey.toString()
    );
    expect(userData.rewardEarnedClaimed.toNumber()).to.equal(0);
    expect(userData.rewardEarnedPending.toNumber()).to.equal(0);
  });

  it("Stake", async () => {
    const { mint, authority, vault } = await createVault(program);

    // add funder
    const { funderAdded } = await vault.addFunder(authority);
    const funderTokenAccount = await mint.createAssociatedAccount(
      funderAdded.publicKey
    );

    const amount = new anchor.BN("1000000");
    await mint.mintTokens(funderTokenAccount, amount.toNumber());

    // fund
    await vault.fund({
      authority,
      funder: funderAdded,
      funderAccount: funderTokenAccount.key,
      amount: new anchor.BN("1000000"),
    });

    const rightSide = "1".padEnd(66, "0");
    let vaultData = await vault.fetch();
    expect(vaultData.rewardRate.toString()).to.equal(
      new anchor.BN(rightSide, 2).toString()
    );

    console.log("Funding exits");

    // create and stake
    const { userAuthority, user, stakeAccount } = await vault.stake();

    // get user and vault data
    vaultData = await vault.fetch();
    let userData = await vault.fetchUser(user);

    expect(userData.mintStakedCount).to.equal(1);
    expect(userData.mintAccounts.length).to.equal(1);
    expect(userData.mintAccounts[0].toString()).to.equal(
      stakeAccount.key.toString()
    );
    expect(vaultData.stakedCount).to.equal(1);
    console.log("First staking");

    // stake again after 10 seconds
    await sleep(5000);

    console.log("Second staking");
    const { stakeAccount: secondStakeAccount } = await vault.stake(
      userAuthority,
      user
    );

    userData = await vault.fetchUser(user);
    vaultData = await vault.fetch();

    expect(userData.mintStakedCount).to.equal(2);
    expect(userData.mintAccounts.length).to.equal(2);
    expect(userData.mintAccounts[1].toString()).to.equal(
      secondStakeAccount.key.toString()
    );
    expect(vaultData.stakedCount).to.equal(2);

    console.log(userData.rewardEarnedPending);
  });
});
