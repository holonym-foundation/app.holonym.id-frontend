import { useState, useEffect, Suspense } from "react";
import { useParams } from "react-router-dom";
import { ethers } from "ethers";
import { useAccount, useSignMessage } from "wagmi";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { requestCredentials } from "../utils/secrets";
import {
  getStateAsHexString,
  getDateAsHexString,
  serializeProof,
  poseidonTwoInputs,
  poseidonHashQuinary,
  createLeaf,
  proofOfResidency,
} from "../utils/proofs";
import axios from "axios";
import { serverAddress } from "../constants/misc";

function getMerkleProofParams(leaf) {
  const leavesFromContract = []; // TODO: Get leaves from merkle tree smart contract
  const leaves = [...leavesFromContract, leaf];
  const tree = new IncrementalMerkleTree(poseidonHashQuinary, 14, "0", 5);
  for (const item of leaves) {
    tree.insert(item);
  }
  const index = tree.indexOf(leaf);
  const merkleProof = tree.createProof(index);
  const [root_, leaf_, path_, indices_] = serializeProof(merkleProof, poseidonHashQuinary); 
  return {
    root : root_,
    leaf : leaf_,
    path : path_,
    indices : indices_
  }
}


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LoadingElement = (props) => <h3 style={{ textAlign: "center" }}>Loading...</h3>;
const Proofs = () => {
  const params = useParams();
  const [creds, setCreds] = useState();
  const [error, setError] = useState();
  const [proof, setProof] = useState();
  const [contractInputs, setContractInputs] = useState();
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const [readyToLoadCreds, setReadyToLoadCreds] = useState();

  const { address } = useAccount();

  const proofs = {
    "us-residency" : { name : "US Residency", loadProof : loadPoR },
    "uniqueness" : { name : "US Residency", loadProof : ()=>null },
  }

  async function loadPoR() {
    const newSecret = creds.newSecret;
    const leaf = await createLeaf(
      serverAddress,
      newSecret,
      creds.countryCode,
      creds.subdivisionHex,
      creds.completedAtHex,
      creds.birthdateHex
    );

    // if(!address) {
    //   setError("Please connect your wallet");
    //   await sleep(1000);
    // } else if(error == "Please connect your wallet") {
    //   setError("");
    // }

    const mp = getMerkleProofParams(leaf);

    const salt =
      "18450029681611047275023442534946896643130395402313725026917000686233641593164"; // this number is poseidon("IsFromUS")
    const footprint = await poseidonTwoInputs([
      salt,
      ethers.BigNumber.from(newSecret).toString(),
    ]);

    const lob3Proof = await proofOfResidency(
      mp.root,
      address, // || "0x483293fCB4C2EE29A02D74Ff98C976f9d85b1AAd", //Delete that lmao
      serverAddress,
      salt,
      footprint,
      creds.countryCode,
      creds.subdivisionHex,
      creds.completedAtHex,
      creds.birthdateHex,
      newSecret,
      mp.leaf,
      mp.path,
      mp.indices,
    );
    console.log(JSON.stringify(lob3Proof));
    setProof(lob3Proof);
    // TODO: Set up calls to smart contracts
    setContractInputs(null);
  }

  useEffect(() => {
    if (!readyToLoadCreds) return;
    async function getCreds() {
      // Delete this line:
      // const c = {birthdate: "1996-09-06", completedAt: "1969-06-09", countryCode: 0, newSecret: "0xb9d3ca1602fad29499f3ee47f729f875", secret: "0x89e0bc2174cb908298ce2f38987995a1", signature: "0x6440eb3b1871fa0e5ad052b81fb6cfe570b8ec74e753c45462778ef5f3302e17071cf538fa78d7c99a2c98e370f7d85ff82942364e8110f2960caf51819128c71b", subdivision: "CA"}
      // Replace with:
      const c = await requestCredentials();
      console.log("creds", JSON.stringify(c));
      if (c) {
        setCreds({
          ...c,
          subdivisionHex: getStateAsHexString(c.subdivision),
          completedAtHex: getDateAsHexString(c.completedAt),
          birthdateHex: getDateAsHexString(c.birthdate),
        });
      } else {
        setError(
          "Could not retrieve credentials for proof. Please make sure you have the Holonym extension installed."
        );
      }
    }
    getCreds();
  }, [readyToLoadCreds]);

  useEffect(() => {
    if (!address) return;
    if (!creds) return;
    if (!(params.proofType in proofs)) return;
    proofs[params.proofType].loadProof();
  }, [creds]);

  useEffect(()=>{
    if (address) setReadyToLoadCreds(true);
  }, [address])

  const ConnectWalletScreen = ()=><h1>Connect wlkanfksjn</h1>
  return (
    <Suspense fallback={<LoadingElement />}>
        <div className="x-container w-container">
          <div className="x-wrapper small-center" style={{ width: "100vw" }}>
            {!address ? <ConnectWalletScreen /> : <>
            <h3>Prove {proofs[params.proofType].name}</h3>
            <div>
              <div>
                {error ? (
                  <p>Error: {error}</p>
                ) : (
                  <>
                    <p>
                      This will publicly link your wallet address to only this aspect of your identity: {proofs[params.proofType].name}. If you would like to do so, please confirm the popup.
                    </p>
                    <button className="x-button" onClick={()=>setSubmissionConsent(true)}>
                      {creds ? "Prove" : "Confirm"}
                    </button>
                  </>
                )}
              </div>
            </div>
            </>}
          </div>
        </div>
    </Suspense>
  );
};

export default Proofs;
