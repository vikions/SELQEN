import React, { Suspense, lazy, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "../../packages/ui/styles.css";
import Landing from "./Landing";
const Lab = lazy(() => import("./Lab"));
function App() {
  const [lab, setLab] = useState(location.hash === "#lab");
  const previousLab = useRef(lab);
  useEffect(() => {
    const route = () => {
      setLab(location.hash === "#lab");
      if (location.hash === "#lab" || !location.hash) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    document.title = lab
      ? "SELQEN · Review lab"
      : "SELQEN — Know what you're signing.";
    if (previousLab.current && !lab)
      document.getElementById("main")?.focus({ preventScroll: true });
    previousLab.current = lab;
  }, [lab]);
  return lab ? (
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
