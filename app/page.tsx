"use client";

import { useEffect, useRef, useState } from "react";
import { SCATTER_SVG, ENVELOPE_SVG } from "./charts";
import "./landing.css";

type DemoStatus = "idle" | "submitting" | "sent" | "error";

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  // One status value, not three booleans — three booleans can contradict
  // each other ("submitting AND sent"), a single value cannot.
  const [demoStatus, setDemoStatus] = useState<DemoStatus>("idle");
  const [demoError, setDemoError] = useState("");
  const [sentToEmail, setSentToEmail] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);

  // Scroll reveal. Ported from the design's DCLogic.componentDidMount.
  // .reveal elements are VISIBLE BY DEFAULT; only below-fold ones get .pending
  // added on mount, removed on intersect, with a 1600ms safety net that clears
  // everything so content is never left hidden if the observer never fires.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    els.forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
        el.classList.add("pending");
      }
    });
    const reveal = (el: Element) => el.classList.remove("pending");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) reveal(e.target);
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    const t = setTimeout(() => els.forEach(reveal), 1600);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  const openDemo = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setDemoOpen(true);
  };
  // Closing always resets to idle, so reopening shows a fresh form rather
  // than a stale confirmation or a stale error.
  const closeDemo = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setDemoOpen(false);
    setDemoStatus("idle");
    setDemoError("");
    setSentToEmail("");
  };
  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Submit to the server and branch on what the server actually says.
  // The modal NEVER closes on an unconfirmed outcome — a failed submission
  // must not look like a successful one.
  const submitDemo = async () => {
    if (demoStatus === "submitting") return; // guards double-submit

    const name = nameRef.current?.value.trim() ?? "";
    const company = companyRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim() ?? "";
    const message = msgRef.current?.value.trim() ?? "";
    const website = websiteRef.current?.value ?? "";

    // Single-route page, so UTMs live on the current URL at submit time.
    const params = new URLSearchParams(window.location.search);

    setDemoStatus("submitting");
    setDemoError("");

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          email,
          message,
          website,
          utm_source: params.get("utm_source") ?? "",
          utm_medium: params.get("utm_medium") ?? "",
          utm_campaign: params.get("utm_campaign") ?? "",
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setSentToEmail(typeof data.email === "string" && data.email ? data.email : email);
        setDemoStatus("sent");
        return;
      }

      setDemoError(
        typeof data?.error === "string" && data.error
          ? data.error
          : "We couldn't save your request. Please try again."
      );
      setDemoStatus("error");
    } catch {
      setDemoError(
        "We couldn't reach the server. Check your connection and try again."
      );
      setDemoStatus("error");
    }
  };

  return (
    <div ref={rootRef}>
      <div className="grid-bg"></div>

      <nav>
        <div className="nav-brand">
          <svg className="nav-seal" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#1A2845" strokeWidth="2.5"></circle>
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1A2845" strokeWidth="0.8"></circle>
            <circle cx="50" cy="50" r="22" fill="#1A2845"></circle>
            <text x="50" y="60" textAnchor="middle" fill="#C9A961" fontFamily="Playfair Display, serif" fontWeight="900" fontSize="28">S</text>
            <polygon points="24,50 26,54 30,54 27,57 28,61 24,59 20,61 21,57 18,54 22,54" fill="#1A2845"></polygon>
            <polygon points="76,50 78,54 82,54 79,57 80,61 76,59 72,61 73,57 70,54 74,54" fill="#1A2845"></polygon>
          </svg>
          <span>Calc<span className="gold-letter">S</span>Hore</span>
        </div>
        <div className="nav-links">
          <a href="#pillars">How it works</a>
          <a href="#standards">Validation</a>
          <a href="https://tcp.calcshore.ai" target="_blank" rel="noopener" className="nav-cta">Open the TCP Generator</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">
          <span className="dot"></span>
          <span>The Concrete Compliance Engine</span>
        </div>

        <h1>
          From spec sheet to<br />
          <span className="accent">stamp-ready </span><span className="hero-nowrap"><span className="accent">submittal,</span> in hours.</span>
        </h1>

        <p className="hero-sub">
          Turn a mix submittal into a stamp-ready thermal control plan in an afternoon, not a week.
        </p>

        <div className="hero-cta-group">
          <a href="https://tcp.calcshore.ai" target="_blank" rel="noopener" className="btn btn-primary">
            Open the TCP Generator
            <svg className="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </a>
          <a href="#" className="btn btn-secondary" onClick={openDemo}>Book a Demo</a>
        </div>

        <p className="hero-reassure">
          Pilot access is by request<span className="dot-sep"></span>Book a demo and we will set you up
        </p>

        <div className="trust-strip">
          <div className="trust-items">
            <div className="trust-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ACI 207 Aligned
            </div>
            <div className="trust-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Validated vs. ConcreteWorks
            </div>
            <div className="trust-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              DOT Submittal Format
            </div>
            <div className="trust-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              PE Stamp-Ready Output
            </div>
          </div>
        </div>
      </section>

      <section className="scenario">
        <div className="scenario-inner">
          <span className="scenario-eyebrow">Sound familiar?</span>
          <p className="scenario-text">
            <span className="muted">A producer emails a 47-page mix submittal at 4:30 on Friday, and the TCP is due Monday.</span>
            CalcSHore turns that weekend into <span className="accent">an afternoon.</span>
          </p>
        </div>
      </section>

      <section className="pillars" id="pillars">
        <div className="pillars-inner">
          <div className="section-header reveal">
            <div className="section-eyebrow">
              <span className="line"></span>
              <span>The Workflow</span>
              <span className="line"></span>
            </div>
            <h2 className="section-title">Stamp. Seal. Submit.</h2>
            <p className="section-sub">
              What used to take a week of spreadsheets and review cycles now takes three steps.
            </p>
          </div>

          <div className="pillar-grid reveal">
            <div className="pillar">
              <div className="pillar-header">
                <span className="pillar-num">01 / THE ENGINE</span>
                <div className="pillar-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h3l3-9 6 18 3-9h3"></path></svg>
                </div>
              </div>
              <h3 className="pillar-name">Simulate</h3>
              <p className="pillar-desc">
                Drop in your mix, geometry, and pour conditions. A peak temperature curve comes back in seconds, not hours.
              </p>
              <ul className="pillar-features">
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Run multiple pour scenarios in one run, comparing placement temperatures, mixes, and curing strategies side by side</span></li>
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Matches the industry-standard solver to within ±1°F on peak temperature, across representative geometries</span></li>
              </ul>
            </div>

            <div className="pillar">
              <div className="pillar-header">
                <span className="pillar-num">02 / THE DOCUMENT</span>
                <div className="pillar-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line><circle cx="12" cy="11" r="1.5" fill="currentColor"></circle></svg>
                </div>
              </div>
              <h3 className="pillar-name">Generate</h3>
              <p className="pillar-desc">
                Simulation outputs flow straight into a complete, editable thermal control plan. You review and approve each section before it's yours.
              </p>
              <ul className="pillar-features">
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Ten-section plan: executive summary, curing, monitoring, contingency, and pre-cooling</span></li>
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Refine any section's wording with built-in AI editing, so your edits drop straight into the report</span></li>
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Every value editable and reviewable, so you stay the author of record</span></li>
              </ul>
            </div>

            <div className="pillar">
              <div className="pillar-header">
                <span className="pillar-num">03 / THE SUBMITTAL</span>
                <div className="pillar-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
              </div>
              <h3 className="pillar-name">Deliver</h3>
              <p className="pillar-desc">
                Export a stamp-ready PDF in the format your reviewer is already used to: same structure, same figures,
                same checklist they expect from a manual submittal. Faster turnaround, fewer redlines.
              </p>
              <ul className="pillar-features">
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>State DOT-formatted PDF, ready for your PE seal</span></li>
                <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Export and submit, no reformatting</span></li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      <section className="deliverable" id="deliverable">
        <div className="deliverable-inner">
          <div className="section-header reveal">
            <div className="section-eyebrow">
              <span className="line"></span>
              <span>The Deliverable</span>
              <span className="line"></span>
            </div>
            <h2 className="section-title">What lands on your desk.</h2>
          </div>

          <div className="deliverable-grid reveal">
            <div className="doc-stack">
              <div className="doc-page-back b1"></div>
              <div className="doc-page-back b2"></div>
              <div className="doc-pill">PE stamp-ready</div>
              <div className="doc-cover">
                <div className="doc-band">
                  <span>Calc<span className="gold-letter">S</span>Hore · Mass Concrete TCP Platform</span>
                  <span>ACI 301-20</span>
                </div>
                <div className="doc-body">
                  <div className="doc-kicker">Thermal Control Plan</div>
                  <div className="doc-title">Mat Foundation</div>
                  <div className="doc-subtitle">6′ × 12′ × 12′ · Reinforced · On Grade</div>
                  <div className="doc-rule"></div>
                  <div className="doc-meta">
                    <div className="doc-meta-row"><span className="k">Governing Standard</span><span className="v">ACI 301-20 · 207.2R</span></div>
                    <div className="doc-meta-row"><span className="k">Placement Date</span><span className="v">2026-06-24</span></div>
                    <div className="doc-meta-row"><span className="k">Peak Core Temp</span><span className="v">135.7°F @ 56 hr</span></div>
                    <div className="doc-meta-row"><span className="k">Compliance</span><span className="v">Verified · ±1°F</span></div>
                  </div>
                  <div className="doc-seal-row">
                    <div className="doc-seal"><span>S</span></div>
                    <div className="doc-seal-text">
                      <span className="t1">Engineer of Record</span>
                      <span className="t2">Prepared for PE review &amp; seal</span>
                    </div>
                  </div>
                </div>
                <div className="doc-footer">
                  <span>CalcSHore · TCP</span>
                  <span>1 of 12</span>
                </div>
              </div>
            </div>

            <div className="deliverable-detail">
              <h3 className="deliverable-headline">A complete, auditable submittal. Not a calculator readout.</h3>
              <p className="deliverable-lead">
                Every run produces a full thermal control plan, formatted the way your reviewer already expects it. Twelve pages, every number traceable, ready for your stamp.
              </p>
              <ul className="deliverable-contents">
                <li><span className="n">01</span>Executive Summary</li>
                <li><span className="n">02</span>Project &amp; Element Info</li>
                <li><span className="n">03</span>Mix Design Compliance</li>
                <li><span className="n">04</span>Thermal Analysis Results</li>
                <li><span className="n">05</span>Thermal Control Program</li>
                <li><span className="n">06</span>Monitoring &amp; Sensor Plan</li>
                <li><span className="n">07</span>Simulation Results</li>
                <li><span className="n">08</span>Contingency Plan</li>
                <li><span className="n">09</span>References &amp; Standards</li>
                <li><span className="n">10</span>PE Sign-Off &amp; Seal</li>
              </ul>
              <div className="deliverable-result">
                <div className="result-chip"><span className="rk">Peak Core</span><span className="rv">135.7°F</span></div>
                <div className="result-chip"><span className="rk">Limit</span><span className="rv">158°F</span></div>
                <div className="result-chip pass"><span className="rk">Core Temp</span><span className="rv">PASS</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="standards" id="standards">
        <div className="standards-inner">
          <div className="section-header reveal">
            <div className="section-eyebrow">
              <span className="line"></span>
              <span>Standards &amp; Validation</span>
              <span className="line"></span>
            </div>
            <h2 className="section-title">The science your reviewer<br />already trusts.</h2>
            <p className="section-sub">
              We didn't invent the physics. We productized the model your DOT already signs off on.
            </p>
          </div>

          <div className="validation-card reveal">
            <div className="validation-banner">
              <div className="validation-banner-stat">
                <span className="validation-tag">Benchmark vs. ConcreteWorks</span>
                <div className="validation-stat">13<span className="of">/ 14</span></div>
              </div>
              <div className="validation-banner-text">
                <div className="validation-headline">Mixes within ±1°F peak temperature</div>
                <p className="validation-desc">
                  Benchmarked head-to-head against ConcreteWorks, the industry-standard reference
                  for mass-concrete thermal modeling, on identical material inputs. Mean difference: 0.3°F.
                </p>
              </div>
            </div>

            <div className="validation-charts">
              <div className="validation-fig">
                <p className="validation-caption">
                  Peak temperature for every reference mix, against ConcreteWorks.
                </p>
                <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: SCATTER_SVG }} />
              </div>

              <div className="validation-fig">
                <p className="validation-caption">
                  Core and surface temperature over a 7-day pour, against ConcreteWorks.
                </p>
                <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: ENVELOPE_SVG }} />
              </div>
            </div>
          </div>

          <div className="standards-strip reveal">
            <div className="standards-strip-label">Aligned With Industry Standards</div>
            <div className="standards-list">
              <div className="standard-badge"><span className="standard-badge-code">ACI 207</span><span className="standard-badge-name">Mass Concrete</span></div>
              <div className="standard-badge"><span className="standard-badge-code">ACI 301</span><span className="standard-badge-name">Specifications</span></div>
              <div className="standard-badge"><span className="standard-badge-code">ConcreteWorks</span><span className="standard-badge-name">Reference Tool</span></div>
              <div className="standard-badge"><span className="standard-badge-code">DOT-Compatible</span><span className="standard-badge-name">Submittal Format</span></div>
            </div>
          </div>

          <div className="limitations-card reveal">
            <div className="limitations-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div className="limitations-content">
              <h4>What we publish, including the limitations.</h4>
              <p>
                On one silica-fume mix in our reference set, our engine runs <em>about 3°F warmer than the reference</em>, a conservative, safe-side difference on an edge case we're still refining. We'd rather show you where the model is honest than ship a number we can't defend in front of a reviewer.
              </p>
            </div>
          </div>

        </div>
      </section>

      <section className="final-cta" id="final-cta">
        <svg className="final-cta-seal" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="100" r="96" fill="none" stroke="#C9A961" strokeWidth="2"></circle>
          <circle cx="100" cy="100" r="88" fill="none" stroke="#C9A961" strokeWidth="0.5"></circle>
          <circle cx="100" cy="100" r="48" fill="#C9A961"></circle>
          <text x="100" y="118" textAnchor="middle" fill="#1A2845" fontFamily="Playfair Display, serif" fontWeight="900" fontSize="56">S</text>
        </svg>

        <div className="final-cta-inner">
          <div className="final-cta-eyebrow reveal">
            <span className="line"></span>
            <span>Ready to Stop Authoring TCPs by Hand?</span>
            <span className="line"></span>
          </div>
          <h2 className="final-cta-headline reveal">Run a sample TCP in <span className="accent">under five minutes.</span></h2>
          <p className="final-cta-sub reveal">
            No login, no sales call. Drop in a mix and a geometry to see what stamp-ready looks like.
          </p>
          <div className="final-cta-actions reveal">
            <a href="https://tcp.calcshore.ai" target="_blank" rel="noopener" className="btn btn-primary">
              Open the TCP Generator
              <svg className="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </a>
            <a href="#" className="btn btn-secondary" onClick={openDemo}>Book a Demo</a>
          </div>
          <div className="final-cta-reassurance reveal">
            <div className="reassurance-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Pilot access is by request</div>
            <div className="reassurance-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Built by two concrete PhDs</div>
            <div className="reassurance-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Talk to a real engineer</div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="footer-logo">
                <svg className="footer-logo-seal" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#C9A961" strokeWidth="2"></circle>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#C9A961" strokeWidth="0.6"></circle>
                  <circle cx="50" cy="50" r="22" fill="#C9A961"></circle>
                  <text x="50" y="60" textAnchor="middle" fill="#1A2845" fontFamily="Playfair Display, serif" fontWeight="900" fontSize="28">S</text>
                  <polygon points="24,50 26,54 30,54 27,57 28,61 24,59 20,61 21,57 18,54 22,54" fill="#C9A961"></polygon>
                  <polygon points="76,50 78,54 82,54 79,57 80,61 76,59 72,61 73,57 70,54 74,54" fill="#C9A961"></polygon>
                </svg>
                <span className="footer-wordmark">Calc<span className="gold-letter">S</span>Hore</span>
              </div>
              <div className="footer-tagline">Stamp · Seal · Submit</div>
            </div>
            <div className="footer-contact">
              <a href="mailto:contact@calcshore.ai">contact@calcshore.ai</a>
              <span className="footer-contact-meta">Mountain View, CA</span>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-copyright">© 2026 Calc<span className="gold-S">S</span>Hore, Inc.</div>
            <a href="#" className="footer-book" onClick={openDemo}>Book a Demo</a>
          </div>
        </div>
      </footer>

      {demoOpen && (
        <div className="demo-overlay" onClick={closeDemo}>
          <div className="demo-modal" onClick={stop}>
            <button className="demo-close" onClick={closeDemo} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            {demoStatus === "sent" ? (
              <div className="demo-sent">
                <div className="demo-sent-mark" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div className="demo-eyebrow">Request received</div>
                <h3 className="demo-title">We've got it.</h3>
                <p className="demo-sub">
                  We've recorded your request and we'll follow up at{" "}
                  <span className="demo-sent-email">{sentToEmail}</span>.
                </p>
                <p className="demo-fallback">
                  If that address isn't right, write to{" "}
                  <a href="mailto:contact@calcshore.ai">contact@calcshore.ai</a>
                </p>
                <button type="button" className="btn btn-primary demo-submit" onClick={() => closeDemo()}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="demo-eyebrow">Book a Demo</div>
                <h3 className="demo-title">See a stamp-ready TCP.</h3>
                <p className="demo-sub">Tell us a little about your work and we'll reach out to set up a 20-minute walkthrough.</p>
                <form
                  className="demo-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitDemo();
                  }}
                >
                  <label className="demo-field">
                    <span>Name</span>
                    <input ref={nameRef} id="demo-name" type="text" required placeholder="Jane Doe" />
                  </label>
                  <label className="demo-field">
                    <span>Company</span>
                    <input ref={companyRef} id="demo-company" type="text" placeholder="Acme Engineering" />
                  </label>
                  <label className="demo-field">
                    <span>Work email</span>
                    <input ref={emailRef} id="demo-email" type="email" required placeholder="jane@acme.com" />
                  </label>
                  <label className="demo-field">
                    <span>What would you like to see? <em>(optional)</em></span>
                    <textarea ref={msgRef} id="demo-msg" rows={3} placeholder="We pour mass concrete bridge footings and need TCPs faster…"></textarea>
                  </label>

                  {/* Honeypot. Off-screen rather than display:none — some bots skip
                      display:none fields. Hidden from screen readers and from tab
                      order, and deliberately NOT required. */}
                  <div className="demo-hp" aria-hidden="true">
                    <label htmlFor="demo-website">Website</label>
                    <input
                      ref={websiteRef}
                      id="demo-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {demoStatus === "error" && (
                    <p className="demo-error" role="alert">
                      {demoError}{" "}
                      <span className="demo-error-fallback">
                        You can also email us directly at{" "}
                        <a href="mailto:contact@calcshore.ai">contact@calcshore.ai</a>.
                      </span>
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary demo-submit"
                    disabled={demoStatus === "submitting"}
                    aria-busy={demoStatus === "submitting"}
                  >
                    {demoStatus === "submitting" ? (
                      <>
                        <span className="demo-spinner" aria-hidden="true"></span>
                        Sending…
                      </>
                    ) : (
                      <>
                        {demoStatus === "error" ? "Try again" : "Send request"}
                        <svg className="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                      </>
                    )}
                  </button>
                  <p className="demo-fallback">Prefer email? Write us at <a href="mailto:contact@calcshore.ai">contact@calcshore.ai</a></p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
