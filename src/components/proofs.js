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
  const [success, setSuccess] = useState();
  const [error, setError] = useState();
  const [proof, setProof] = useState();
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const [readyToLoadCreds, setReadyToLoadCreds] = useState();
  
  const { data: account } = useAccount();
  
  // const p = {"scheme":"g16","curve":"bn128","proof":{"a":["0x0394cdfb69e0bf0cd40b8af80745aa5290ed4ae05d564e018cbe277a74ce27f1","0x16201bf18d50f1777055c59288a41b0c7b479ae1198a92509f18bfb0f4821d52"],"b":[["0x06f568cbee90e8fd2fcc1298b2a0539de30861f8d0b720c7a2832ca23f000ef7","0x1c8ff884fa2cf0fc5c6be670817cf2be48ef8c4341d1daaab4b0d6225a88cf16"],["0x12eb028f9ed8f2a8288cfbdcd9ad2f6522f0f41d97aaf999031c6dd0a3ec6173","0x008b1a3ec12147bb8f757df6e6b2181c9914d6f63e005cb1e17bc10b721423ab"]],"c":["0x0bc5f67695ffe6bed2691a9f40bf7d599fca67662642223240780cbc6d1060b9","0x054fe806f25a21ad517b0dc0030a8d824bd39295305c527564e7ba11fd7e038e"]},"inputs":["0x18488055d4e1cc4a8d739751fd79b802448bcd83042fb3a17f88b1e7de4b0b21","0x000000000000000000000000b1d534a8836fb0d276a211653aeea41c6e11361e","0x0000000000000000000000008281316ac1d51c94f2de77575301cef615adea84","0x28ca58c3c1044c5277405071d5e3754aeaa4f91dae2c8647275f0b168ae4a94c","0x211b2f2ee8f97521aea073c7ec27425c3b16ee61ef77965990667e634ce52fed","0x0000000000000000000000000000000000000000000000000000000000000002"]};
  // const { 
  //   data: txResp,
  //   isError,
  //   isLoading,
  //   reset,
  //   writeAsync: submitIt
  //  } = useContractWrite({
  //   // mode: "recklesslyUnprepared", // Preparing it here causes bugs i couldn't easily fix 
  //   addressOrName: proofContractAddresses["optimistic-goerli"]["ResidencyStore"],
  //   contractInterface: residencyStoreABI
  // },
  //   "prove"
  //   // args: [p.proof, p.inputs],
  //   // enabled: (proof && submissionConsent),
  // )

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

  useEffect(()=>{
    if(!(submissionConsent && creds && proof)) return;
    submitTx()
  }, [proof, submissionConsent])

  if(account && !window.ethereum) {
    setError("Currently, this only works with MetaMask");
    return;
  }
  
  
  async function submitTx() {
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
    const resStore = new ethers.Contract(proofContractAddresses["optimistic-goerli"]["ResidencyStore"], residencyStoreABI, signer);
    try {
      const result = await resStore.prove(
        Object.keys(proof.proof).map(k=>proof.proof[k]), // Convert struct to ethers format 
        proof.inputs
      )
      setSuccess(true);
    } catch (e) {
      setError(e.reason);
    }
    
    // DElete this lines
    // setProof({"scheme":"g16","curve":"bn128","proof":{"a":["0x24ad59fcbd9a5218b145db8ab52a46584601e862cc4ece36313e0ecf25d029e4","0x1f5e2de28ed755248d8b9090fba4995b0f68dab97db1880ea1129fc25d75200d"],"b":[["0x0e9768ff8dbcba99fc82e24f25f174bd1d59195a29dbee13ee1d19e80eb0494c","0x0785e66582b727b39402df0679601016f984618b8167962e2963e32e7eb88178"],["0x1ec2ae548cb7328c8178ab287af94cdacfb911d751c569c889a69a22862d3522","0x01f7b95371344db09b9339f856cd5735b3000ab553cc850f454eef91a945f8f8"]],"c":["0x02712ccce3fecd039831bb8ffe34f04631b58c253125f78660e25ae0b454e188","0x17b1a977f4d523b7a1f8ae15e11e64605265c35024f305888c43f4b473a5b6e1"]},"inputs":["0x18488055d4e1cc4a8d739751fd79b802448bcd83042fb3a17f88b1e7de4b0b21","0x000000000000000000000000c8834c1fcf0df6623fc8c8ed25064a4148d99388","0x0000000000000000000000008281316ac1d51c94f2de77575301cef615adea84","0x28ca58c3c1044c5277405071d5e3754aeaa4f91dae2c8647275f0b168ae4a94c","0x211b2f2ee8f97521aea073c7ec27425c3b16ee61ef77965990667e634ce52fed","0x0000000000000000000000000000000000000000000000000000000000000002"]})
    // setCreds("a")
    // setSubmissionConsent(true)
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
