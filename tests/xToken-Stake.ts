import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { XTokenStake } from "../target/types/x_token_stake";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import {
  checkTokenAccounts,
  createVault,
  getRewardAddress,
  sleep,
} from "./fixtures/lib";
import { UserData, VaultData } from "./fixtures/vault";

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

  xit("Stake and Unstake", async () => {
    let userData: UserData;
    let vaultData: VaultData;

    //-----------    create vault     ------------//
    const { mint, authority, vault } = await createVault(program);

    //----------- add funder and fund ------------//
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

    //----------- create user and stake ------------//
    const { userAuthority, user, stakeAccount } = await vault.stake();

    // get user and vault data
    vaultData = await vault.fetch();
    userData = await vault.fetchUser(user);

    // check staked account is not owned by user anymore
    let stakeAccountOwned = await checkTokenAccounts(
      program,
      userAuthority.publicKey,
      stakeAccount.key
    );
    expect(!stakeAccountOwned).to.be.true;

    // check user data and vault data
    expect(userData.mintStakedCount).to.equal(1);
    expect(userData.mintAccounts.length).to.equal(1);
    expect(userData.mintAccounts[0].toString()).to.equal(
      stakeAccount.key.toString()
    );
    expect(vaultData.stakedCount).to.equal(1);

    //----------- unstake after 5 seconds ------------//
    await sleep(5000);
    await vault.unstake(userAuthority, user, stakeAccount);

    // check staked account is owned by user again
    expect(
      await checkTokenAccounts(
        program,
        userAuthority.publicKey,
        stakeAccount.key
      )
    ).to.be.true;

    // check user and vault data
    userData = await vault.fetchUser(user);
    vaultData = await vault.fetch();

    expect(userData.mintStakedCount).to.equal(0);
    expect(userData.mintAccounts.length).to.equal(0);
    expect(vaultData.stakedCount).to.equal(0);
    const firstEarned = userData.rewardEarnedPending.toNumber();

    //------------- stake again after 5 seconds ------------//
    await sleep(5000);

    console.log("Now staking again");
    const { stakeAccount: secondStakeAccount } = await vault.stake(
      userAuthority,
      user
    );

    userData = await vault.fetchUser(user);
    vaultData = await vault.fetch();

    expect(userData.mintStakedCount).to.equal(1);
    expect(userData.mintAccounts.length).to.equal(1);
    expect(userData.mintAccounts[0].toString()).to.equal(
      secondStakeAccount.key.toString()
    );
    expect(vaultData.stakedCount).to.equal(1);
    expect(userData.rewardEarnedPending.toNumber()).to.equal(firstEarned);
  });

  it("claim", async () => {
    let userData: UserData;

    //-----------    create vault     ------------//
    const { mint, authority, vault } = await createVault(program);

    //----------- add funder and fund ------------//
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

    //----------- create user and stake ------------//
    const { userAuthority, user, stakeAccount } = await vault.stake();

    //----------- claim after 5 seconds ------------//
    await sleep(5000);
    await vault.claim(authority.publicKey, userAuthority, user);

    userData = await vault.fetchUser(user);
    expect(userData.rewardEarnedPending.toNumber()).to.equal(0);
    expect(userData.rewardEarnedClaimed.toNumber()).to.above(0);
  });
});
