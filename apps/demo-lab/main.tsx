import React, { Suspense, lazy, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "../../packages/ui/styles.css";
import Landing from "./Landing";
const Lab = lazy(() => import("./Lab"));
const ReceiptPage = lazy(() => import("./ReceiptPage"));
function App() {
  const [lab, setLab] = useState(location.hash === "#lab");
  const [receipts, setReceipts] = useState(location.hash === "#receipt");
  const previousLab = useRef(lab);
  useEffect(() => {
    const route = () => {
      setLab(location.hash === "#lab");
      setReceipts(location.hash === "#receipt");
      if (["#lab", "#receipt", ""].includes(location.hash))
        window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    document.title = receipts
      ? "SELQEN · Receipt registry"
      : lab
        ? "SELQEN · Review lab"
        : "SELQEN — Know what you're signing.";
    if (previousLab.current && !lab)
      document.getElementById("main")?.focus({ preventScroll: true });
    previousLab.current = lab;
  }, [lab, receipts]);
  return receipts ? (
    <Suspense fallback={<p role="status">Opening receipt registry…</p>}>
      <ReceiptPage />
    </Suspense>
  ) : lab ? (
    <Suspense fallback={<p role="status">Opening the review lab…</p>}>
      <Lab />
    </Suspense>
  ) : (
    <Landing />
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
