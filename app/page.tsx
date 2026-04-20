import Image from "next/image";

// TODO: swap to tcp.calcshore.ai / mixdesign.calcshore.ai once custom domains are configured
const TCP_URL = "https://calcshore.vercel.app";
const MIX_DESIGN_URL = "https://calcshore-mixdesign.vercel.app";

export default function Home() {
  return (
    <div className="min-h-screen bg-ice flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center gap-12 w-full max-w-xl">

          <div className="w-full max-w-[520px]">
            <Image
              src="/logo-horizontal.png"
              alt="CalcShore — Concrete Compliance Engine"
              width={3001}
              height={865}
              priority
              className="w-full h-auto"
              sizes="(max-width: 640px) 100vw, 520px"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <a
              href={TCP_URL}
              className="flex-1 flex flex-col items-center justify-center gap-1 border-2 border-navy rounded-lg px-6 py-5 bg-white text-navy hover:bg-navy hover:text-ice transition-colors duration-150 group"
            >
              <span className="font-serif text-lg font-normal">CalcSHore TCP</span>
              <span className="text-sm font-sans text-navy/60 group-hover:text-ice/70 transition-colors duration-150">
                Thermal Control Plans
              </span>
            </a>

            <a
              href={MIX_DESIGN_URL}
              className="flex-1 flex flex-col items-center justify-center gap-1 border-2 border-navy rounded-lg px-6 py-5 bg-white text-navy hover:bg-navy hover:text-ice transition-colors duration-150 group"
            >
              <span className="font-serif text-lg font-normal">CalcSHore Mix Design</span>
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
