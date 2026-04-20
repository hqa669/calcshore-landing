// TODO: swap to tcp.calcshore.ai / mixdesign.calcshore.ai once custom domains are configured
const TCP_URL = "https://calcshore.vercel.app";
const MIX_DESIGN_URL = "https://calcshore-mixdesign.vercel.app";

// Strata + shore mark: horizontal layered bands (geological/concrete strata)
// bisected by a vertical calculation axis — the shore where material meets math.
function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CalcShore logo mark"
    >
      <title>CalcShore</title>
      <rect width="48" height="48" rx="6" fill="#0F1E3D" />
      <rect x="6" y="10" width="36" height="5" rx="1" fill="#E8EEF5" opacity="0.15" />
      <rect x="6" y="17" width="36" height="5" rx="1" fill="#C9A961" opacity="0.35" />
      <rect x="6" y="24" width="36" height="5" rx="1" fill="#E8EEF5" opacity="0.25" />
      <rect x="6" y="31" width="36" height="5" rx="1" fill="#C9A961" opacity="0.15" />
      <rect x="22.5" y="6" width="3" height="36" rx="1.5" fill="#C9A961" />
      <path d="M6 6 L6 14 M6 6 L14 6" stroke="#E8EEF5" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 6 L42 14 M42 6 L34 6" stroke="#E8EEF5" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 42 L6 34 M6 42 L14 42" stroke="#E8EEF5" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 42 L42 34 M42 42 L34 42" stroke="#E8EEF5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-ice flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-8 w-full max-w-xl">

          <div className="flex flex-col items-center gap-4">
            <LogoMark size={72} />
            <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-navy">
              CalcShore
            </h1>
          </div>

          <p className="text-navy/70 text-base sm:text-lg text-center font-sans leading-relaxed">
            Concrete compliance documentation, automated.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <a
              href={TCP_URL}
              className="flex-1 flex flex-col items-center justify-center gap-1 border-2 border-navy rounded-lg px-6 py-5 bg-white text-navy hover:bg-navy hover:text-ice transition-colors duration-150 group"
            >
              <span className="font-serif text-lg font-normal">CalcShore TCP</span>
              <span className="text-sm font-sans text-navy/60 group-hover:text-ice/70 transition-colors duration-150">
                Thermal Control Plans
              </span>
            </a>

            <a
              href={MIX_DESIGN_URL}
              className="flex-1 flex flex-col items-center justify-center gap-1 border-2 border-navy rounded-lg px-6 py-5 bg-white text-navy hover:bg-navy hover:text-ice transition-colors duration-150 group"
            >
              <span className="font-serif text-lg font-normal">CalcShore Mix Design</span>
              <span className="text-sm font-sans text-navy/60 group-hover:text-ice/70 transition-colors duration-150">
                Mix Design Submittals
              </span>
            </a>
          </div>

        </div>
      </main>

      <footer className="flex items-center justify-between px-6 py-4 border-t border-navy/10 text-xs font-sans text-navy/50">
        <span>© 2026 CalcShore</span>
        <a
          href="mailto:hello@calcshore.ai"
          className="hover:text-navy transition-colors duration-150"
        >
          hello@calcshore.ai
        </a>
      </footer>
    </div>
  );
}
