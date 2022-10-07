import { useState, useEffect, Suspense } from "react";
import { useParams } from "react-router-dom";
import { ethers } from "ethers";
import { useAccount, useContractWrite } from "wagmi";
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
import { serverAddress } from "../constants/misc";
import ConnectWallet from "./atoms/ConnectWallet";
import proofContractAddresses from "../constants/proofContractAddresses.json";
import residencyStoreABI from "../constants/abi/zk-contracts/ResidencyStore.json"


const ConnectWalletScreen = () => (
  <>
    <ConnectWallet />
    <div className="x-container w-container">
          <div className="x-wrapper small-center" style={{ width: "100vw" }}>
            <h1>Please Connect Your Wallet First</h1>
          </div>
    </div>
  </>
)
async function getMerkleProofParams(leaf) {
  const leaves = await (await fetch(`https://relayer.holonym.id/getLeaves`)).json();
  if(leaves.indexOf(leaf) == -1){
    console.error(`Could not find leaf ${leaf} from querying on-chain list of leaves ${leaves}`)
  }

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
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const [readyToLoadCreds, setReadyToLoadCreds] = useState();
  
  const { data: account } = useAccount();

  const submitProof = useContractWrite({
    mode: "recklesslyUnprepared", // Preparing it here causes bugs i couldn't easily fix 
    addressOrName: proofContractAddresses["optimistic-goerli"]["ResidencyStore"],
    contractInterface: residencyStoreABI,
    functionName: "prove",
    args: [p.proof, p.inputs],
    // enabled: (proof && submissionConsent),
  })

  const proofs = {
    "us-residency" : { name : "US Residency", loadProof : loadPoR },
    "uniqueness" : { name : "US Residency", loadProof : ()=>null },
  }

  async function loadPoR() {
    console.log("loading us residency proof")
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

    const mp = await getMerkleProofParams(leaf);

    const salt =
      "18450029681611047275023442534946896643130395402313725026917000686233641593164"; // this number is poseidon("IsFromUS")
    const footprint = await poseidonTwoInputs([
      salt,
      ethers.BigNumber.from(newSecret).toString(),
    ]);

    const lob3Proof = await proofOfResidency(
      mp.root,
      account.address, // || "0x483293fCB4C2EE29A02D74Ff98C976f9d85b1AAd", //Delete that lmao
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
  }

  useEffect(() => {
    if (!readyToLoadCreds) return;
    async function getCreds() {
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
    if (!(account?.address)) return;
    if (!creds) return;
    if (!(params.proofType in proofs)) return;
    proofs[params.proofType].loadProof();
  }, [creds]);

  useEffect(()=>{
    if (account?.address) setReadyToLoadCreds(true);
  }, [account])

  return (
    <Suspense fallback={<LoadingElement />}>
        <div className="x-container w-container">
          <div className="x-wrapper small-center" style={{ width: "100vw" }}>
            {!(account?.address) ? <ConnectWalletScreen /> : <>
            <h3>Prove {proofs[params.proofType].name}</h3>
            <div>
              <div>
                {error ? (
                  <p>Error: {error}</p>
                ) : (
                  <>
                    <p>
                      {creds ? 
                      `This will publicly link your wallet address to only this aspect of your identity: ${proofs[params.proofType].name}. If you would like to do so, please confirm the popup.`
                        :
                      `Please confirm the popup so your proof can be generated`
                      }
                      
                    </p>
                    {creds ? <button className="x-button" onClick={()=>setSubmissionConsent(true)}>Prove</button>: null}
                    
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
