import { useState, useEffect, Suspense } from "react";
import { useParams } from "react-router-dom";
import { ethers } from "ethers";
import { useAccount, useContractWrite } from "wagmi";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { requestCredentials } from "../utils/secrets";
import {
  getStateAsHexString,
  getDateAsHexString,
  getMerkleProofParams,
  poseidonTwoInputs,
  createLeaf,
  proofOfResidency,
} from "../utils/proofs";
import { serverAddress } from "../constants/misc";
import ConnectWallet from "./atoms/ConnectWallet";
import proofContractAddresses from "../constants/proofContractAddresses.json";
import residencyStoreABI from "../constants/abi/zk-contracts/ResidencyStoreSmall.json"
import { Success } from "./success";
import { LineWave } from "react-loader-spinner";


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

const LoadingProofsButton = (props) => (
  <button className="x-button" style={{height: "85px"}} onClick={props.onClick}>
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
  }}>
  Proof Loading
  <LineWave
  height="50"
  width="50"
  color="#01010c"
  ariaLabel="line-wave"
  wrapperStyle={{}}
  wrapperClass="blocks-wrapper"
  visible={true}
  firstLineColor=""
  middleLineColor=""
  lastLineColor=""
  />
</div>
</button> 
)


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LoadingElement = (props) => <h3 style={{ textAlign: "center" }}>Loading...</h3>;
const Proofs = () => {
  const params = useParams();
  const [creds, setCreds] = useState();
  const [success, setSuccess] = useState();
  const [error, setError] = useState();
  const [proof, setProof] = useState();
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const [readyToLoadCreds, setReadyToLoadCreds] = useState();
  
  const { data: account } = useAccount();
  
  const proofs = {
    "us-residency" : { name : "US Residency", loadProof : loadPoR, contractAddress: proofContractAddresses["optimistic-goerli"]["ResidencyStore"], contractABI: residencyStoreABI },
    "uniqueness" : { name : "US Residency", loadProof : ()=>null },
  }

  async function loadPoR() {
    console.log("loading us residency proof")

    const salt = "18450029681611047275023442534946896643130395402313725026917000686233641593164"; // this number is poseidon("IsFromUS")
    const footprint = await poseidonTwoInputs([
      salt,
      ethers.BigNumber.from(creds.newSecret).toString(),
    ]);

    const por = await proofOfResidency(
      account.address,
      serverAddress,
      salt,
      footprint,
      creds.countryCode,
      creds.subdivisionHex,
      creds.completedAtHex,
      creds.birthdateHex,
      creds.newSecret,
    );
    setProof(por);
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

  useEffect(()=>{
    if(!(submissionConsent && creds && proof)) return;
    submitTx(proofs[params.proofType].contractAddress, proofs[params.proofType].contractABI);
  }, [proof, submissionConsent])

  if(account && !window.ethereum) {
    setError("Currently, this only works with MetaMask");
    return;
  }
  
  
  async function submitTx(addr, abi) {
    window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
          chainId: "0x1a4",
          rpcUrls: ["https://goerli.optimism.io/"],
          chainName: "Optimism Goerli Testnet",
          nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18
          },
          blockExplorerUrls: ["https://goerli-optimism.etherscan.io"]
      }]
    });
  
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const resStore = new ethers.Contract(addr, abi, signer);
    try {
      const result = await resStore.prove(
        Object.keys(proof.proof).map(k=>proof.proof[k]), // Convert struct to ethers format 
        proof.inputs
      )
      setSuccess(true);
    } catch (e) {
      setError(e.reason);
    }
  }

  if(success){
    return <Success title="Success" />
  }

  return (
    // <Suspense fallback={<LoadingElement />}>
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
                      `Press prove to publicly link your wallet address to only this part of your identity: ${proofs[params.proofType].name}. The proof may take up to 15 seconds to load`
                        :
                      `Please confirm the popup so your proof can be generated`
                      }
                      
                    </p>
                    {creds ? 
                      (proof ? <button className="x-button" onClick={()=>setSubmissionConsent(true)}>Submit proof</button> : <LoadingProofsButton />) 
                      : 
                      ""
                    }                    
                  </>
                )}
              </div>
            </div>
            </>}
          </div>
        </div>
    // </Suspense>
  );
};

export default Proofs;
