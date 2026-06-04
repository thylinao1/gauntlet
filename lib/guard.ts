// lib/guard.ts
// The input side of the runtime guard. A keyword blocklist is weak: attackers rephrase, encode
// (base64, hex), or use unicode tricks to slip past it. So every input is first normalized and
// decoded, then scored against weighted patterns rather than matched against bare words. This
// stays free, deterministic, and adds no API call. The production-grade answer for novel
// paraphrased attacks is a trained classifier run locally for free (Meta Llama Prompt Guard 2,
// or protectai/deberta-v3-base-prompt-injection on Hugging Face); see the README.

const ZERO_WIDTH = /[​-‍﻿⁠­]/g;

// Common homoglyphs attackers use to break string matches (Cyrillic and lookalikes to Latin).
const HOMOGLYPHS: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", к: "k",
  і: "i", ѕ: "s", ԁ: "d", ɡ: "g", ⅼ: "l", "0": "o",
};

function mapHomoglyphs(s: string): string {
  let out = "";
  for (const ch of s) out += HOMOGLYPHS[ch] ?? ch;
  return out;
}

export function normalize(text: string): string {
  let t = text.normalize("NFKC").replace(ZERO_WIDTH, "");
  t = mapHomoglyphs(t).toLowerCase();
  t = t.replace(/[\s._-]+/g, " ").trim(); // collapse spacing / separator tricks
  return t;
}

// Pull out and decode base64 / hex blobs so an encoded instruction is scanned in cleartext too.
export function expandEncodings(text: string): string {
  let extra = "";
  for (const m of text.matchAll(/[A-Za-z0-9+/]{16,}={0,2}/g)) {
    try {
      const decoded = Buffer.from(m[0], "base64").toString("utf8");
      if (/[a-z]{3,}\s+[a-z]{3,}/i.test(decoded)) extra += " " + decoded;
    } catch {
      /* not base64 */
    }
  }
  for (const m of text.matchAll(/(?:[0-9a-f]{2}[\s:]*){10,}/gi)) {
    try {
      const decoded = Buffer.from(m[0].replace(/[^0-9a-f]/gi, ""), "hex").toString(
        "utf8",
      );
      if (/[a-z]{3,}\s+[a-z]{3,}/i.test(decoded)) extra += " " + decoded;
    } catch {
      /* not hex */
    }
  }
  return extra ? `${text} ${extra}` : text;
}

interface Pattern {
  re: RegExp;
  weight: number;
  label: string;
}

// Weighted intent patterns, matched against normalized + decoded text. Threshold-based, so two
// weak signals together can block, and no single keyword decides on its own.
const PATTERNS: Pattern[] = [
  { re: /ignore (all |the |your )?(previous|prior|above|earlier|preceding) /, weight: 3, label: "instruction override" },
  { re: /disregard (all |the |your )?(previous|prior|above|rules|instructions)/, weight: 3, label: "instruction override" },
  { re: /forget (everything|all|your|the) (you|prior|previous|instructions)/, weight: 3, label: "instruction override" },
  { re: /(reveal|disclose|print|repeat|show|expose|leak|share|give|output) (me )?(your |the |it )?(system ?prompt|instructions|configuration|hidden|secret|directive|token|key|password|credentials|internal record)/, weight: 3, label: "exfiltration" },
  { re: /(what (are|is)|tell me|show me|give me) (your )?(exact |full |complete )?(system )?(instructions|prompt|configuration|rules|directive)/, weight: 3, label: "system-prompt exfiltration" },
  { re: /repeat (the )?(text|everything|message|words|prompt) (above|before|verbatim)/, weight: 3, label: "system-prompt exfiltration" },
  { re: /\bverbatim\b|word for word/, weight: 2, label: "verbatim request" },
  { re: /(print|show|give|confirm|reveal|display).{0,40}(customer|account|internal) record/, weight: 3, label: "data exfiltration" },
  { re: /\bssn\b|social security number|credit card number/, weight: 2, label: "sensitive data request" },
  { re: /you are (now |a )?(dan|an? (unrestricted|jailbroken|developer|admin|root|god|evil))/, weight: 3, label: "role-play jailbreak" },
  { re: /\bdo anything now\b/, weight: 3, label: "role-play jailbreak" },
  { re: /(pretend|act as if|roleplay|role-play) (you are|to be|that)/, weight: 2, label: "role-play" },
  { re: /(maintenance|developer|debug|god|admin|sudo|jailbreak) mode/, weight: 2, label: "fake mode" },
  { re: /(run|execute|exec|invoke) (the )?(command|cmd|shell|`?env`?|code|tool|function)/, weight: 3, label: "tool abuse" },
  { re: /\benv\b|\/etc\/|os\.system|subprocess|rm -rf/, weight: 2, label: "tool abuse" },
  { re: /(override|bypass|turn off|disable|switch off|remove) (your |the |all )?(rules|guardrails|safety|filters|restrictions|guidelines)/, weight: 3, label: "guardrail bypass" },
  { re: /(decode|base64|rot13|from hex|deobfuscate).{0,40}(and )?(follow|execute|obey|do|run)/, weight: 3, label: "encoded payload" },
  { re: /(treat|consider) (this|the following|the text) as (a )?(trusted |system )?(directive|command|instruction)/, weight: 2, label: "instruction smuggling" },
  { re: /no (rules|restrictions|limits|guidelines|filters)/, weight: 1, label: "constraint removal" },
];

const BLOCK_THRESHOLD = 3;

export interface GuardAssessment {
  blocked: boolean;
  score: number;
  reason: string;
}

export function assessInjection(rawPrompt: string): GuardAssessment {
  const expanded = expandEncodings(rawPrompt);
  const encoded = expanded !== rawPrompt;
  const text = normalize(expanded);

  let score = encoded ? 1 : 0; // an encoded blob is itself a mild signal
  const labels = new Set<string>();
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      score += p.weight;
      labels.add(p.label);
    }
  }

  const blocked = score >= BLOCK_THRESHOLD;
  const detail = [...labels].slice(0, 2).join(", ") || "injection pattern";
  const reason = blocked
    ? `Blocked at the input filter: ${detail}${encoded ? " (decoded from an encoded payload)" : ""}.`
    : "";
  return { blocked, score, reason };
}
