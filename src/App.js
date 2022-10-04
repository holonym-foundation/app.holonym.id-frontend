import "./App.css";
import "./holo-wtf.webflow.css";
import "./normalize.css";
import "./webflow.css";
import AuthenticationFlow from "./components/authentication-flow.js";
import Registry from "./components/registry.js";
import { HomeLogo } from "./components/logo.js";
import { Lookup } from "./components/lookup.js";
import Verify from "./components/verify";
import Verified from "./components/verified";
import React, { useEffect, useState } from "react";
import WebFont from "webfontloader";
import Address from "./components/atoms/Address.js";
import WalletModal from "./components/atoms/WalletModal";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useConnect, useAccount, useNetwork } from "wagmi";
// import { desiredChain } from "./constants/desiredChain";
import {
  ChainSwitcher,
  ChainSwitcherModal,
  useDesiredChain,
} from "./components/chain-switcher";
import Error from "./components/errors.js";

const Proofs = React.lazy(() => import("./components/proofs"));

function App() {
  const { desiredChain, setDesiredChain } = useDesiredChain();
  const { data: account } = useAccount();
  const [walletModalShowing, setWalletModalShowing] = useState(false);
  useEffect(() => {
    WebFont.load({
      google: {
        families: [
          "Montserrat:100,100italic,200,200italic,300,300italic,400,400italic,500,500italic,600,600italic,700,700italic,800,800italic,900,900italic",
        ],
      },
    });
  }, []);

  let myHoloPage = <AuthenticationFlow />;

  return (
    <div className="App x-section wf-section bg-img">
      <div className="x-container nav w-container">
        <WalletModal
          visible={walletModalShowing}
          setVisible={setWalletModalShowing}
          blur={true}
        />
        <HomeLogo />

        {account?.address && account?.connector ? (
          <Address address={account.address} />
        ) : (
          <div className="nav-btn">
            <div
              className="wallet-connected nav-button"
              // disabled={!connectors[0].ready}
              // key={connectors[0].id}
              onClick={() => setWalletModalShowing(true)}
            >
              <div style={{ opacity: 0.5 }}>Connect Wallet</div>
            </div>
          </div>
        )}
      </div>
      <Router>
        <Routes>
          <Route
            path="/orcid/token/*"
            element={
              <AuthenticationFlow
                token={
                  window.location.href.split(
                    "/token/#"
                  )[1] /*It is safe to assume that the 1st item of the split is the token -- if not, nothing bad happens; the token will be rejected. 
                                                                                                    You may also be asking why we can't just get the token from the URL params. React router doesn't allow # in the URL params, so we have to do it manually*/
                }
                credentialClaim={"sub"}
                web2service={"ORCID"}
              />
            }
          />
          {/*Google has a different syntax and redirect pattern than ORCID*/}
          <Route
            path="/google/token/:token"
            element={
              <AuthenticationFlow credentialClaim={"email"} web2service={"Google"} />
            }
          />

          <Route
            path="/twitter/token/:token"
            element={
              <AuthenticationFlow credentialClaim={"creds"} web2service={"Twitter"} />
            }
          />
          <Route
            path="/GitHub/token/:token"
            element={
              <AuthenticationFlow credentialClaim={"creds"} web2service={"Github"} />
            }
          />
          <Route
            path="/discord/token/:token"
            element={
              <AuthenticationFlow credentialClaim={"creds"} web2service={"Discord"} />
            }
          />

          <Route path="/lookup/:web2service/:credentials" element={<Lookup />} />
          <Route path="/l/:web2service/:credentials" element={<Lookup />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route
            exact
            path={"/whitepaper"}
            element={
              <div className="bg-img x-section wf-section" style={{ width: "100vw" }}>
                <div style={{ height: "80vh", width: "100vw" }}>
                  {/* <embed src="https://holonym.id/whitepaper.pdf" width="800px" height="2100px" /> */}
                  <embed
                    src="http://www.africau.edu/images/default/sample.pdf"
                    width="100%"
                    height="100%"
                  />
                </div>
              </div>
            }
          />
          <Route path="/registry" element={<Registry />} />
          {/* <Route path='/private' element={<LitCeramic stringToEncrypt={JWTObject.header.raw + '.' + JWTObject.payload.raw}/>} /> */}
          <Route path={"/"} element={myHoloPage} />
          <Route path={"/myholo"} element={myHoloPage} />
          <Route path={"/zk-id/verify"} element={<Verify />} />
          <Route path={"/zk-id/verified"} element={<Verified />} />
          <Route path={"/zk-id/proofs/:proofType"} element={<Proofs />} />
          <Route path={"/chainswitchertest"} element={<ChainSwitcher />} />
          <Route path={"/chainswitchermodaltest"} element={<ChainSwitcherModal />} />
        </Routes>
      </Router>
    </div>

    // </Auth0Provider>
  );
}

export default App;
