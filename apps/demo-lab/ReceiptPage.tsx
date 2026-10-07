import React, { useEffect, useRef, useState } from "react";
import { Brand } from "../../packages/ui/Review";
import {
  parseReceiptFile,
  MAX_RECEIPT_BYTES,
  type ReceiptFile,
} from "../../packages/receipts";
import {
  REGISTRY,
  EXPLORER,
  readAnchor,
  submissionStatus,
  connectWallet,
  anchorReceipt,
  walletError,
  type WalletProvider,
} from "../../packages/receipts/registry";
import type { Hex } from "viem";
import "./receipt.css";

export default function ReceiptPage() {
  const [file, setFile] = useState<ReceiptFile>();
  const [filename, setFilename] = useState("");
  const [provider, setProvider] = useState<WalletProvider>();
  const [account, setAccount] = useState<Hex>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [timestamp, setTimestamp] = useState<bigint>();
  const [tx, setTx] = useState<Hex>();
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const announce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (
        detail?.info?.rdns === "io.metamask" &&
        typeof detail.provider?.request === "function"
      )
        setProvider((p) => p ?? detail.provider);
    };
    const legacy = () => {
      const p = (
        window as Window & {
          ethereum?: WalletProvider & { isMetaMask?: boolean };
        }
      ).ethereum;
      if (p?.isMetaMask && typeof p.request === "function")
        setProvider((current) => current ?? p);
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.addEventListener("ethereum#initialized", legacy);
    legacy();
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      generation.current++;
      window.removeEventListener("eip6963:announceProvider", announce);
      window.removeEventListener("ethereum#initialized", legacy);
    };
  }, []);
  useEffect(() => {
    const reset = () => setAccount(undefined);
    provider?.on?.("accountsChanged", reset);
    provider?.on?.("chainChanged", reset);
    provider?.on?.("disconnect", reset);
    return () => {
      provider?.removeListener?.("accountsChanged", reset);
      provider?.removeListener?.("chainChanged", reset);
      provider?.removeListener?.("disconnect", reset);
    };
  }, [provider]);
  async function check(selected: ReceiptFile, n: number, submitted?: Hex) {
    const time = await readAnchor(selected.hash);
    if (n !== generation.current) return;
    setTimestamp(time);
    setStatus(
      time > 0n
        ? "This exact file is registered on Robinhood Chain."
        : "This file hash has not been registered yet.",
    );
    if (time === 0n && submitted) {
      const state = await submissionStatus(submitted);
      if (n !== generation.current) return;
      if (state === "reverted") {
        try {
          localStorage.removeItem(`selqen-anchor:${selected.hash}`);
        } catch {
          /* Storage is optional. */
        }
        setTx(undefined);
        setError(
          `Previous transaction reverted: ${submitted}. No hash was registered; you can retry.`,
        );
      } else
        setStatus(
          state === "pending"
            ? "Transaction is pending or not yet visible. Check the transaction link before retrying."
            : "Transaction confirmed, but this hash is not registered. Check the transaction link.",
        );
    }
  }
  async function upload(chosen: File) {
    const n = ++generation.current;
    setFile(undefined);
    setTimestamp(undefined);
    setTx(undefined);
    setError("");
    setStatus("");
    setBusy(true);
    try {
      if (chosen.size > MAX_RECEIPT_BYTES)
        throw new Error("Choose a receipt smaller than 1 MB.");
      const selected = parseReceiptFile(
        new Uint8Array(await chosen.arrayBuffer()),
      );
      if (n !== generation.current) return;
      setFile(selected);
      setFilename(chosen.name);
      let saved: Hex | undefined;
      try {
        const value = localStorage.getItem(`selqen-anchor:${selected.hash}`);
        if (value && /^0x[0-9a-fA-F]{64}$/.test(value)) saved = value as Hex;
      } catch {
        /* Storage is optional. */
      }
      if (saved) setTx(saved);
      setStatus("Checking the registry…");
      await check(selected, n, saved);
    } catch (e) {
      if (n === generation.current) setError(walletError(e));
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  async function connect() {
    if (!provider) return;
    const n = generation.current;
    setBusy(true);
    setError("");
    try {
      const a = await connectWallet(provider);
      if (n === generation.current) setAccount(a);
    } catch (e) {
      if (n === generation.current) setError(walletError(e));
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  async function anchor() {
    if (!provider || !file || !account || busy || tx) return;
    const n = generation.current;
    setBusy(true);
    setError("");
    setStatus("Confirm the anchor transaction in MetaMask.");
    try {
      const result = await anchorReceipt(file.hash, provider, (hash) => {
        if (n === generation.current) {
          setTx(hash);
          setStatus("Transaction submitted. Waiting for confirmation…");
        }
        try {
          localStorage.setItem(`selqen-anchor:${file.hash}`, hash);
        } catch {
          /* Keep the transaction visible even when browser storage is unavailable. */
        }
      });
      if (n !== generation.current) return;
      setTimestamp(result.timestamp);
      setStatus(
        result.alreadyAnchored
          ? "This exact file is already registered. No transaction was requested."
          : "Receipt hash registered. The transaction and event were confirmed.",
      );
    } catch (e) {
      if (n === generation.current) {
        setError(walletError(e));
        setStatus("");
      }
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  async function refresh() {
    if (!file) return;
    const n = generation.current;
    setBusy(true);
    setError("");
    try {
      await check(file, n, tx);
    } catch (e) {
      if (n === generation.current) setError(walletError(e));
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  return (
    <div className="receipt-page">
      <header>
        <a href="#" aria-label="SELQEN home">
          <Brand />
        </a>
        <a href="#">Back to SELQEN</a>
      </header>
      <main>
        <p className="receipt-kicker">Robinhood Chain · 4663</p>
        <h1 tabIndex={-1} ref={heading}>
          Keep a record.
          <br />
          <span>Verify it later.</span>
        </h1>
        <p className="receipt-intro">
          Register the hash of your SELQEN report, or check an existing record.
          Your file stays in this browser.
        </p>
        <section
          className="receipt-upload"
          aria-labelledby="receipt-upload-title"
        >
          <h2 id="receipt-upload-title">Choose your exported receipt</h2>
          <label htmlFor="receipt-file">
            SELQEN live receipt · JSON · up to 1 MB
          </label>
          <input
            id="receipt-file"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void upload(chosen);
            }}
          />
          <p>
            In the extension, choose “Anchor receipt” to download the report and
            open this page. Import that downloaded file here.
          </p>
        </section>
        {file && (
          <section className="receipt-record" aria-label="Receipt details">
            <h2>{filename}</h2>
            <dl>
              <dt>Asset in file</dt>
              <dd>{file.data.snapshot.symbol ?? "Stock Token"}</dd>
              <dt>Report created</dt>
              <dd>{new Date(file.data.createdAt).toLocaleString()}</dd>
              <dt>Receipt hash · Keccak-256</dt>
              <dd>
                <code>{file.hash}</code>
              </dd>
              <dt>Registry</dt>
              <dd>
                <a
                  href={`${EXPLORER}/address/${REGISTRY}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {REGISTRY}
                </a>
              </dd>
              {timestamp !== undefined && timestamp > 0n && (
                <>
                  <dt>Registered at</dt>
                  <dd>{new Date(Number(timestamp) * 1000).toLocaleString()}</dd>
                </>
              )}
            </dl>
            <p className="receipt-boundary">
              Registration proves this hash was submitted. It does not verify
              the report’s contents or trade safety. The submitter is not
              necessarily the report’s author.
            </p>
            <div className="receipt-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void refresh()}
              >
                Check registration
              </button>
              {timestamp === 0n &&
                !tx &&
                (!account ? (
                  <button
                    disabled={busy || !provider}
                    onClick={() => void connect()}
                  >
                    {provider
                      ? "Connect MetaMask · Robinhood Chain"
                      : "MetaMask not detected"}
                  </button>
                ) : (
                  <button disabled={busy} onClick={() => void anchor()}>
                    Anchor hash · gas required
                  </button>
                ))}
            </div>
            {account && (
              <p className="receipt-account">
                Connected: <code>{account}</code>
              </p>
            )}
            {timestamp === 0n && (
              <p>
                Anchoring is optional and costs ETH on Robinhood Chain. Only the
                file hash is stored; changing any file byte changes its hash.
              </p>
            )}
            {tx && (
              <p>
                <a
                  href={`${EXPLORER}/tx/${tx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View anchor transaction ↗
                </a>
                {timestamp === 0n &&
                  " · Check the transaction before retrying. A submitted hash will not be sent again from this page."}
              </p>
            )}
          </section>
        )}
        <div className="receipt-status" role="status">
          {busy && "Working… "}
          {status}
        </div>
        {error && (
          <p className="receipt-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          Exact-file verification · No file uploads · Optional wallet
          transaction
        </footer>
      </main>
    </div>
  );
}
