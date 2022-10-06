import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { useParams } from "react-router-dom";

import {
  storeCredentials,
  getIsHoloRegistered,
  requestCredentials,
} from "../utils/secrets";
import { zkIdVerifyEndpoint, serverAddress } from "../constants/misc";
import {
  getStateAsHexString,
  getDateAsHexString,
  onAddLeafProof,
} from "../utils/proofs";
import { Success } from "./verified-final-screen";

// For test credentials, see id-server/src/main/utils/constants.js
const dummyUserCreds = {
  countryCode: 2,
  subdivision: "New York",
  completedAt: "2022-09-16", // "2022-09-16T02:21:59.510Z",
  birthdate: "1950-01-01",
};

// Display success message, and retrieve user credentials to store in browser
const Verified = () => {
  const { jobID } = useParams();
  const [error, setError] = useState();
  const [loading, setLoading] = useState();
  const [storageSuccess, setStorageSuccess] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [successScreen, setSuccessScreen] = useState(false);
  // TODO: Check whether user is logged in too
  const [creds, setCreds] = useState();

  async function getCredentials() {
    // if (!localStorage.getItem("holoTempSecret")) {
    //   return;
    // }
    setError(undefined);
    setLoading(true);
    try {
      // const secret = localStorage.getItem("holoTempSecret");
      const resp = await fetch(
        `${zkIdVerifyEndpoint}/registerVouched/vouchedCredentials?jobID=${jobID}`
      );
      // Shape of data == { user: completeUser }
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLoading(false);
        const credsTemp = data.user;
        setCreds(credsTemp);
        localStorage.removeItem("holoTempSecret");
        return credsTemp;
      }
    } catch (err) {
      console.log(err);
      setError(`Error: ${err.message}`);
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitForUserRegister() {
    let isRegistered = await getIsHoloRegistered();
    while (!isRegistered) {
      await sleep(100);
      isRegistered = await getIsHoloRegistered();
    }
  }

  useEffect(() => {
    async function func() {
      const isRegistered = await getIsHoloRegistered();
      // Only setRegistered at this first check. If user had not registered before
      // reaching this page, we want to keep on the page the instructions for the
      // non-registered user
      setRegistered(isRegistered);
      if (!isRegistered) {
        await waitForUserRegister();
        setError(undefined);
      }
      const credsTemp = await getCredentials();

      try {
        setCreds({
          ...credsTemp,
          subdivisionHex: getStateAsHexString(credsTemp.subdivision),
          completedAtHex: getDateAsHexString(credsTemp.completedAt),
          birthdateHex: getDateAsHexString(credsTemp.birthdate),
        });
      } catch(e) {
        setError("There was a problem in storing your credentials");
      }

      const success = await storeCredentials(credsTemp);
      setStorageSuccess(success);
      if (!success)
        setError("Could not receive confirmation from user to store credentials");
    }
    try {
      func();
    } catch (err) {
      console.log(err);
      setError(`Error: ${err.message}`);
    }
    // For tests
    // storeCredentials(dummyUserCreds).then((success) => {
    //   setCreds({
    //     ...dummyUserCreds,
    //     subdivisionHex: getStateAsHexString(dummyUserCreds.subdivision),
    //     completedAtHex: getDateAsHexString(dummyUserCreds.completedAt),
    //     birthdateHex: getDateAsHexString(dummyUserCreds.birthdate),
    //   });
    //   setStorageSuccess(success);
    // });
  }, []);

  async function addLeaf() {
    const newCreds = await requestCredentials();
    const oldSecret = creds.secret;
    const newSecret = newCreds.newSecret;
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
    const RELAYER_URL = "https://relayer.holonym.id";
    let res;
    try {
      res = await axios.post(`${RELAYER_URL}/addLeaf`, {
        addLeafArgs: {
          issuer: serverAddress,
          v: v,
          r: r,
          s: s,
          zkp: oalProof.proof,
          zkpInputs: oalProof.inputs,
        },
      });
      if(res.status == 200) {
        setSuccessScreen(true);
      }
    } catch (e) {
      console.log("There was an error:", e);
      setError("There was an error in submitting your transaction...perhaps you have already minted a Holo?");
    }
    console.log("result");
    console.log(res);
  }

  if(successScreen) {
    return <Success />
  }
  return (
    <>
      { loading ? (
        <h3 style={{ textAlign: "center" }}>Loading credentials...</h3>
      ) : (
        <div>
          <h3 style={{ textAlign: "center" }}>Almost finished!</h3>
          <br />
          <div style={{ maxWidth: "600px", fontSize: "16px" }}>
            <i>
              <ol>
                {!registered && (
                  <li>
                    <p>
                      Open the Holonym extension, and create an account by entering a
                      password (be sure to remember it)
                    </p>
                  </li>
                )}
                <li>
                  <p>
                    Login to the Holonym popup{" "}
                    {!registered && "(after creating an account)"}
                  </p>
                </li>
                <p>
                  <li>Confirm your credentials</li>
                </p>
                <li>
                  <p>Share your credentials</p>
                  <p style={{ fontSize: ".8em" }}>
                    (The extension generates a new secret for you and requires your
                    consent to share it)
                  </p>
                </li>
                <li>
                  <p>Mint your Holo</p>
                </li>
              </ol>
            </i>
            <br />
            <h4>The Holonym extension will store your encrypted credentials.</h4>
            <br />
            {creds && storageSuccess ? (
              <div style={{ textAlign: "center" }}>
                <button className="x-button-blue" onClick={addLeaf}>
                  Mint Your Holo
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <button className="x-button-blue greyed-out-button">
                  Mint Your Holo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <p>{error}</p>
    </>
  );
};

export default Verified;