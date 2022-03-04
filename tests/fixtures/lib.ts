import * as anchor from "@project-serum/anchor";

function toPublicKey<T extends anchor.web3.PublicKey | anchor.web3.Keypair>(
  val: T
): anchor.web3.PublicKey {
  if ("publicKey" in val) {
    return val.publicKey;
  } else {
    return val;
  }
}

export { toPublicKey };
