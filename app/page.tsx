import Console from "@/components/Console";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8">
      <header className="mb-10">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-alert" />
          <span className="font-semibold tracking-tight">GAUNTLET</span>
          <span className="text-muted">/ AI red-team</span>
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Throw your AI in.
          <br />
          <span className="text-muted">See what survives.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          An autonomous agent that attacks your AI app the way a real attacker
          would — prompt injection, jailbreaks, system-prompt leakage, tool abuse
          — then scores it against the{" "}
          <span className="text-text">OWASP LLM Top 10</span> and hands you a
          one-click runtime guard. Prompt injection is the{" "}
          <span className="text-text">#1 LLM risk</span>, and most teams ship AI
          with zero adversarial testing.
        </p>
      </header>

      <main className="flex-1">
        <Console />
      </main>

      <footer className="mt-12 border-t border-edge pt-5 font-mono text-xs text-muted">
        <p>
          Demo runs offline against bundled, deliberately-vulnerable targets with
          planted canaries. Gauntlet reduces the top exploitable risks — it does
          not make any AI &ldquo;100% safe.&rdquo;{" "}
          <span className="text-text">Beyond Tomorrow Hackathon</span> ·
          Next.js · OWASP LLM Top 10 (2025).
        </p>
      </footer>
    </div>
  );
}
