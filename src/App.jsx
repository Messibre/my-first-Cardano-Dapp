import React, { useEffect, useState } from "react";
import { MeshProvider, useWallet } from "@meshsdk/react";
import { Transaction } from "@meshsdk/core";
import "./styles.css";

function formatLovelaceToAda(lovelaceValue) {
  const lovelaceBigInt = BigInt(lovelaceValue || "0");
  const LOVELACE_PER_ADA = BigInt(1_000_000);
  const adaIntegerPart = lovelaceBigInt / LOVELACE_PER_ADA;
  const adaFractionalPart = lovelaceBigInt % LOVELACE_PER_ADA;
  const integerStr = adaIntegerPart.toString();
  const fractionalStr = adaFractionalPart.toString().padStart(6, "0");
  return `${integerStr}.${fractionalStr} ADA`;
}

const initialTxStatus = {
  step: "idle",
  message: "No transaction started yet.",
  txHash: null,
};

function ConnectionCard() {
  const {
    connect,
    disconnect,
    connected,
    name,
    error: walletError,
  } = useWallet();
  const [statusMessage, setStatusMessage] = useState("Not connected");

  function isWalletInstalled(browserKey) {
    if (typeof window === "undefined") return false;
    if (!window.cardano) return false;
    return Boolean(window.cardano[browserKey]);
  }

  async function handleConnect(walletId) {
    try {
      const browserKey =
        walletId === "flint-wallet" ? "flint" : walletId.toLowerCase();

      if (!isWalletInstalled(browserKey)) {
        setStatusMessage(
          `Wallet "${walletId}" is not installed. Please install it first from its official website.`
        );
        return;
      }

      setStatusMessage(`Connecting to ${walletId}...`);
      await connect(walletId);
      setStatusMessage(`Connected to ${walletId}!`);
    } catch (err) {
      console.error("Connection error:", err);
      setStatusMessage(
        "Failed to connect. Maybe you rejected the connection or there was a network issue."
      );
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      setStatusMessage("Disconnected from wallet.");
    } catch (err) {
      console.error("Disconnect error:", err);
      setStatusMessage("Error while disconnecting. Please reload the page.");
    }
  }

  useEffect(() => {
    if (walletError) {
      setStatusMessage(`Wallet error: ${walletError.message || walletError}`);
    }
  }, [walletError]);

  return (
    <div className="card">
      <h2 className="card-title">Wallet Connection</h2>

      <p className="status-line">
        Status:{" "}
        <span
          className={connected ? "status-connected" : "status-disconnected"}
        >
          {connected ? "Connected" : "Disconnected"}
        </span>
      </p>

      {!connected && (
        <div className="button-row">
          <button
            className="btn btn-connect"
            onClick={() => handleConnect("nami")}
          >
            Connect Nami
          </button>
          <button
            className="btn btn-connect"
            onClick={() => handleConnect("eternl")}
          >
            Connect Eternl
          </button>
          <button
            className="btn btn-connect"
            onClick={() => handleConnect("flint-wallet")}
          >
            Connect Flint
          </button>
        </div>
      )}

      {connected && (
        <div className="button-row">
          <p className="connected-wallet-label">Connected wallet: {name}</p>
          <button className="btn btn-disconnect" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}

      <p className="helper-text">{statusMessage}</p>
    </div>
  );
}

function WalletCard() {
  const { wallet, connected } = useWallet();
  const [address, setAddress] = useState("");
  const [balanceLovelace, setBalanceLovelace] = useState("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [txStatus, setTxStatus] = useState(initialTxStatus);
  const [isTxRunning, setIsTxRunning] = useState(false);

  async function loadAddress() {
    if (!wallet) return;
    try {
      const changeAddress = await wallet.getChangeAddress();
      setAddress(changeAddress);
    } catch (err) {
      console.error("Failed to get change address:", err);
      setAddress("Could not load address. Check wallet connection.");
    }
  }

  async function getBalance() {
    if (!connected || !wallet) return;

    try {
      setIsLoadingBalance(true);
      const assets = await wallet.getBalance();
      const lovelaceAsset =
        assets.find((asset) => asset.unit === "lovelace") || null;
      const quantity = lovelaceAsset ? lovelaceAsset.quantity : "0";
      setBalanceLovelace(quantity);
    } catch (err) {
      console.error("Failed to get balance:", err);
      setBalanceLovelace("0");
    } finally {
      setIsLoadingBalance(false);
    }
  }

  async function sendToSelf() {
    if (isTxRunning || !connected || !wallet) return;

    try {
      setIsTxRunning(true);
      setTxStatus({
        step: "building",
        message: "Building transaction to send 1 ADA to your own address...",
        txHash: null,
      });

      const changeAddress = await wallet.getChangeAddress();
      const ONE_ADA_IN_LOVELACE = "1000000";
      const tx = new Transaction({ initiator: wallet });
      tx.sendLovelace(changeAddress, ONE_ADA_IN_LOVELACE);
      const unsignedTx = await tx.build();

      setTxStatus({
        step: "signing",
        message: "Please sign the transaction in your wallet...",
        txHash: null,
      });

      const signedTx = await wallet.signTx(unsignedTx);

      setTxStatus({
        step: "submitting",
        message: "Submitting transaction to the Cardano testnet...",
        txHash: null,
      });

      const txHash = await wallet.submitTx(signedTx);

      setTxStatus({
        step: "confirming",
        message:
          "Transaction submitted! Waiting briefly before updating balance...",
        txHash,
      });

      await new Promise((resolve) => setTimeout(resolve, 8000));
      await getBalance();

      setTxStatus({
        step: "success",
        message: "Transaction successful!",
        txHash,
      });

      try {
        await fetch("http://localhost:4000/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txHash,
            walletAddress: changeAddress,
            network: "preprod",
          }),
        });
      } catch (apiErr) {
        console.error("Failed to notify backend about transaction:", apiErr);
      }
    } catch (err) {
      console.error("Transaction error:", err);
      setTxStatus({
        step: "error",
        message:
          err?.info?.message ||
          err?.message ||
          "Transaction failed. Please check your wallet and try again.",
        txHash: null,
      });
    } finally {
      setIsTxRunning(false);
    }
  }

  useEffect(() => {
    if (connected && wallet) {
      loadAddress();
      getBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, wallet]);

  if (!connected) return null;

  const formattedAda = formatLovelaceToAda(balanceLovelace);

  return (
    <div className="card">
      <h2 className="card-title">Wallet Details</h2>

      <div className="field">
        <span className="field-label">Address:</span>
        <span className="field-value address-value">{address}</span>
      </div>

      <div className="field">
        <span className="field-label">Balance:</span>
        <span className="field-value">
          {isLoadingBalance ? (
            "Loading balance..."
          ) : (
            <>
              {balanceLovelace} lovelace ({formattedAda})
            </>
          )}
        </span>
      </div>

      <div className="button-row">
        <button
          className="btn btn-balance"
          onClick={getBalance}
          disabled={isLoadingBalance}
        >
          {isLoadingBalance ? "Checking..." : "Check Balance"}
        </button>

        <button
          className="btn btn-send"
          onClick={sendToSelf}
          disabled={isTxRunning}
        >
          {isTxRunning ? "Sending..." : "Send 1 ADA to Self"}
        </button>
      </div>

      <TransactionStatus status={txStatus} />
    </div>
  );
}

function TransactionStatus({ status }) {
  const { step, message, txHash } = status || initialTxStatus;
  const txUrl = txHash
    ? `https://preprod.cardanoscan.io/transaction/${txHash}`
    : null;

  return (
    <div className="tx-status">
      <h3 className="tx-title">Transaction Status</h3>
      <p className="tx-step">
        Step: <span className="tx-step-value">{step}</span>
      </p>
      <p className="tx-message">{message}</p>
      {txHash && (
        <p className="tx-hash">
          Tx Hash:{" "}
          <a href={txUrl} target="_blank" rel="noreferrer">
            {txHash}
          </a>
        </p>
      )}
    </div>
  );
}

export default function App() {
  return (
    <MeshProvider>
      <div className="app-root">
        <header className="app-header">
          <h1 className="app-title">My First Cardano dApp</h1>
          <p className="app-subtitle">
            Connect your Cardano testnet wallet, see your balance, and send 1
            ADA to yourself.
          </p>
        </header>

        <main className="app-main">
          <ConnectionCard />
          <WalletCard />
        </main>
      </div>
    </MeshProvider>
  );
}
