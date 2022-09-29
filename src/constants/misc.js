export const preprocEndpoint = "https://preproc-zkp.s3.us-east-2.amazonaws.com";
export const zkIdVerifyEndpoint =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://zk.sciverse.id";

export const serverAddress = "0x8281316aC1D51c94f2DE77575301cEF615aDea84";
