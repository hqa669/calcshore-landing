# calcshore-landing

Landing page for [CalcShore](https://calcshore.ai) — a concrete compliance documentation platform. This single-page site routes visitors to CalcShore's two products: TCP (Thermal Control Plans) and Mix Design (FHWA 1608 / ACI 301 submittals). No marketing content, no backend — just a product selector built with Next.js 14, TypeScript, and Tailwind CSS.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new) — framework is detected automatically.
3. In the Vercel project settings, add the custom domain `calcshore.ai` and follow the DNS instructions.
4. Once deployed, update the two URL constants at the top of `app/page.tsx` when `tcp.calcshore.ai` and `mixdesign.calcshore.ai` are configured.

No environment variables or build-time configuration are required.
