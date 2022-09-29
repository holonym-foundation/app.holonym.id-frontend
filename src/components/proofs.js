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
  onAddLeafProof,
  proofOfResidency,
} from "../utils/proofs";
import axios from "axios";
import { serverAddress } from "../constants/misc";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LoadingElement = (props) => <h3 style={{ textAlign: "center" }}>Loading...</h3>
const Proofs = () => {
  const params = useParams();
  const [creds, setCreds] = useState();
  const [error, setError] = useState();
  const [proof, setProof] = useState();
  const { address } = useAccount();

  async function addLeaf() {
    // onAddLeafProof
    const oldSecret = creds.secret;
    const newSecret = creds.newSecret;
    const oalProof = await onAddLeafProof(
      serverAddress,
      creds.countryCode,
      creds.subdivisionHex,
      creds.completedAtHex,
      creds.birthdateHex,
      oldSecret,
      newSecret
    );
    console.log("oalProof", oalProof);
    const { v, r, s } = ethers.utils.splitSignature(creds.signature);
    const RELAYER_URL = "https://relayer.holonym.id"
    // console.log(
    //   `${RELAYER_URL}/addLeaf`, JSON.stringify({
    //     addLeafArgs: {
    //         issuer : serverAddress, 
    //         v :  v, 
    //         r : r, 
    //         s : s, 
    //         zkp : oalProof.proof, 
    //         zkpInputs : oalProof.inputs
    //     }
    //   })
    // )
    let res;
    try {
      res = await axios.post(`${RELAYER_URL}/addLeaf`, {
        addLeafArgs: {
            issuer : serverAddress, 
            v :  v, 
            r : r, 
            s : s, 
            zkp : oalProof.proof, 
            zkpInputs : oalProof.inputs
        }
      });
    } catch (e) {
      console.log("There was an error:", e);
      setError("There was an error in submitting your transaction");
    }
     
    console.log("result");
    console.log(res);
  }
  
  async function loadLobby3Proof() {
    const newSecret = creds.newSecret;
    const leaf = await createLeaf(
      serverAddress,
      newSecret,
      creds.countryCode,
      creds.subdivisionHex,
      creds.completedAtHex,
      creds.birthdateHex,
    );

    console.log("leaf", leaf)
    const leavesFromContract = []; // TODO: Get leaves from merkle tree smart contract
    const leaves = [...leavesFromContract, leaf];
    const tree = new IncrementalMerkleTree(poseidonHashQuinary, 14, "0", 5);
    for (const item of leaves) {
      tree.insert(item);
    }
    const index = tree.indexOf(leaf);
    const merkleProof = tree.createProof(index);
    const serializedMerkleProof = serializeProof(merkleProof, poseidonHashQuinary);
    
    // if(!address) {
    //   setError("Please connect your wallet"); 
    //   await sleep(1000);
    // } else if(error == "Please connect your wallet") {
    //   setError("");
    // }
    const salt =  "18450029681611047275023442534946896643130395402313725026917000686233641593164"; // this number is poseidon("IsFromUS")
    const footprint = await poseidonTwoInputs([
      salt, 
      ethers.BigNumber.from(newSecret).toString()
    ]);
    
    const [root_, leaf_, path_, indices_] = serializedMerkleProof;
    const lob3Proof = await proofOfResidency(
      root_,
      address || "0x483293fCB4C2EE29A02D74Ff98C976f9d85b1AAd", //Delete that lmao      
      serverAddress,
      salt,
      footprint,
      creds.countryCode,
      creds.subdivisionHex,
      creds.completedAtHex,
      creds.birthdateHex,
      newSecret,
      leaf_, 
      path_,
      indices_
    );
    console.log(JSON.stringify(lob3Proof));
    setProof(lob3Proof);
    // TODO: Call smart contracts
    // contract.updateLeaf(oalProof)
    // contract.proveResidence(lob3Proof)
  }

  useEffect(() => {
    async function init() {
      // Delete this line:
      // const c = {birthdate: "1996-09-06", completedAt: "1969-06-09", countryCode: 0, newSecret: "0xb9d3ca1602fad29499f3ee47f729f875", secret: "0x89e0bc2174cb908298ce2f38987995a1", signature: "0x6440eb3b1871fa0e5ad052b81fb6cfe570b8ec74e753c45462778ef5f3302e17071cf538fa78d7c99a2c98e370f7d85ff82942364e8110f2960caf51819128c71b", subdivision: "CA"}
      // Replace with:
      const c = await requestCredentials();
      // console.log("creds", JSON.stringify(c));
      if (c) {
        setCreds({
          ...c, 
          subdivisionHex : getStateAsHexString(c.subdivision),
          completedAtHex : getDateAsHexString(c.completedAt),
          birthdateHex : getDateAsHexString(c.completedAt)
        });
      } else {
        setError("Could not retrieve credentials for proof. Please make sure you have the Holonym extension installed.");
      }
      console.log("creds", c);
    }
    init();
  }, []);

  useEffect(() => {
    console.log("entered useEffect");
    if (!creds) return;
    const proofType = params.proofType;
    console.log(`proofType: ${proofType}`);
    if (proofType === "lobby3") {
      loadLobby3Proof();
    } else if (proofType === "addLeaf") {
      // addLeaf();
    }
  }, [creds]);

  return (
    <Suspense fallback={<LoadingElement />}>
      {
        // true ? <><LoadingElement /><p>Currently, generating a proof may take 10-60s depending on your device</p></> : 
        <div className="x-container w-container">
          <div className="x-wrapper small-center" style={{ width: "100vw" }}>
            <h3>Make your Holo</h3>
            <div>
              <div>
                {error ? (
                  <p>Error: {error}</p>
                ) : (
                  <>
                  <p>
                    When you see the popup, please confirm that you would like to
                    share your credentials with this web page
                  </p>
                  <button className="verification-button" onClick={addLeaf}>Mint Your Holo</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      }
    </Suspense>
  );
};

export default Proofs;
