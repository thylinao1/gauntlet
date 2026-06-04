import Console from "@/components/Console";

export default function Home() {
  return (
    <div className="relative isolate mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8">
      <div className="hero-glow" aria-hidden="true" />
      <header className="animate-row mb-10">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-alert" />
          <span className="font-semibold tracking-tight">GAUNTLET</span>
          <span className="text-muted">/ AI red-team</span>
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
          Every chatbot has a few things
          <br />
          <span className="text-muted">it&rsquo;s not supposed to say.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Gauntlet goes after your bot the way a real attacker would and shows
          you exactly what slipped out. When something leaks, one click turns on a
          guard that shuts it down. Every attack maps to the{" "}
          <span className="text-text">OWASP LLM Top 10</span>, the standard list
          of ways these systems break.
        </p>
      </header>

      <main className="flex-1">
        <Console />
      </main>

      <footer className="mt-12 border-t border-edge pt-5 font-mono text-xs text-muted">
        <p>
          The demo runs offline against bundled, deliberately vulnerable bots with
          planted secrets. Gauntlet lowers the risks that are easiest to exploit.
          It does not make any AI &ldquo;100% safe.&rdquo;{" "}
          <span className="text-text">Beyond Tomorrow Hackathon</span>. Next.js.
          OWASP LLM Top 10 (2025).
        </p>
      </footer>
    </div>
  );
}
