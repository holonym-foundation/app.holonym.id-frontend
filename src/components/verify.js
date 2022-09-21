import { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { zkIdVerifyEndpoint } from "../constants/server";

const Verify = (props) => {
  const { data: account } = useAccount();
  const { data, isLoading, signMessage } = useSignMessage({
    onSuccess(data, variables) {
      window.location.href = `${zkIdVerifyEndpoint}/register?address=${account.address}&signature=${data}`;
    },
  });
  const [error, setError] = useState(undefined);
  // Get secret message to sign from server
  async function getSecretMessage() {
    try {
      const resp = await fetch(
        `${zkIdVerifyEndpoint}/initialize?address=${account.address}`
      );
      return (await resp.json()).message;
    } catch (err) {
      console.log(err);
    }
  }

  async function handleClick() {
    const msg = await getSecretMessage();
    if (msg) {
      localStorage.setItem("holoTempSecret", msg);
      signMessage({ message: msg });
    } else {
      setError(
        "Could not retrieve message to sign. Please make sure you're connected to your wallet."
      );
    }
  }

  return (
    <>
      <div className="x-container w-container">
        <div className="x-wrapper small-center" style={{ width: "100vw" }}>
          <h1>What's this?</h1>
          <p>
            You will scan your ID document and receive information from it. We will not
            store your personal info. You can use the data to generate a zero-knowledge
            proof, a cryptographic proof that hides your data from everyone except for
            you. Before clicking the button, please make sure you have the Holonym
            extension installed.
          </p>
          <p>
            Note: Only proceed if you are using a personal computer (not a public one).
            Your info will be encrypted, but to be safe, only use a computer that is
            solely yours or that will be used only by people you trust.
          </p>
          <h2>Requirements</h2>
          <div style={{ textAlign: "left" }}>
            <ul>
              <li>
                <p>
                  Make sure you have a crypto wallet (such as{" "}
                  <a
                    href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en"
                    target="_blank"
                    rel="noreferrer"
                    className="simple-peach-link"
                  >
                    MetaMask
                  </a>
                  ) installed
                </p>
              </li>
              <li>
                <p>
                  Make sure you have the{" "}
                  <a
                    href="https://chrome.google.com/webstore/detail/holonym/oehcghhbelloglknnpdgoeammglelgna?hl=en"
                    target="_blank"
                    rel="noreferrer"
                    className="simple-peach-link"
                  >
                    Holonym browser extension
                  </a>{" "}
                  installed
                </p>
              </li>
            </ul>
          </div>
          <div
            style={{
              maxWidth: "400px",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
              marginTop: "25px",
            }}
          >
            <div onClick={handleClick} className="verification-button">
              Verify yourself
            </div>
          </div>
          {error && <p>Error: {error}</p>}
        </div>
      </div>
    </>
  );
};

export default Verify;
