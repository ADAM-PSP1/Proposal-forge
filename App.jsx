import React, { useState } from "react";
import {
  Search,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  RotateCcw,
  Sparkles,
  Building2,
  UserCircle2,
  FileText,
} from "lucide-react";

// =============================================================================
// Proposal Forge v2 — Maps research to exact [[placeholder]] structure of the
// Positive proposal template (g_y634yguif65f2pc).
// Positive-branded UI: Outfit + Lato, brand blue + lime tick.
// =============================================================================

const GAMMA_MCP_URL = "https://mcp.gamma.app/mcp";
const DEFAULT_TEMPLATE_ID = "g_y634yguif65f2pc";

const FONT_IMPORTS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Lato:wght@300;400;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
`;

// Positive design tokens
const BLUE = "#0A50D3";
const BLUE_HOVER = "#0840A8";
const BLUE_TINT = "#E1ECFB";
const LIME = "#A1E220";
const LIME_TINT = "rgba(161, 226, 32, 0.14)";
const DARK = "#0B1012";
const PAGE = "#F4F5EE";
const CARD = "#FFFFFA";
const INK = "#000000";
const INK_SOFT = "#4A4D43";
const BORDER = "#E5E7E0";
const ERROR = "#D33A2C";

const SHADOW_SM = "0 1px 2px rgba(11, 16, 18, 0.06), 0 1px 3px rgba(11, 16, 18, 0.08)";
const SHADOW_MD = "0 4px 8px rgba(11, 16, 18, 0.06), 0 8px 24px rgba(11, 16, 18, 0.08)";
const SHADOW_LG = "0 12px 24px rgba(11, 16, 18, 0.10), 0 24px 48px rgba(11, 16, 18, 0.12)";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function callClaude({ system, messages, tools = [], mcp_servers = [], max_tokens = 4000 }) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens,
    system,
    messages,
  };
  if (tools.length) body.tools = tools;
  if (mcp_servers.length) body.mcp_servers = mcp_servers;

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

function getTextBlocks(data) {
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function getMcpResults(data) {
  return (data.content || [])
    .filter((b) => b.type === "mcp_tool_result")
    .map((b) => b.content?.[0]?.text || "")
    .join("\n");
}

function parseJson(text) {
  let cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  return JSON.parse(cleaned);
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/gamma\.app\/[^\s"'<>)]+/i);
  return m ? m[0] : null;
}

function formatAuDate() {
  return new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const RESEARCH_SYSTEM = `You are a senior B2B sales researcher and strategist for Positive Salary Packaging, an independent Australian novated leasing and salary packaging provider based in Brisbane. Positive helps Australian employers offer salary packaging benefits — primarily novated car leases (including EVs eligible for the Electric Car Discount FBT exemption) — to their employees at zero cost to the business.

Your job: take meeting notes plus contact details, do web research, and produce content that maps DIRECTLY to specific placeholders in an existing proposal template.

The proposal template is fixed. You are only writing these pieces of content:
1. A personalised intro paragraph for page 1 (2-3 sentences) that reflects back what came up in the meeting and connects it to what the proposal does about it — no narrating the act of listening, just demonstrate it
2. A short intro paragraph for page 2 (1-2 sentences) explaining why Positive + this employer makes sense
3. Two value propositions (heading + body each), tailored to what THIS employer actually cares about

CLAIM VALIDATION — NON-NEGOTIABLE:
Every specific claim in templateContent must be traceable to exactly one of two sources:
1. MEETING NOTES — something the prospect explicitly said or described in the notes provided
2. VERIFIED RESEARCH — something confirmed via web search; cite where you found it

Do not infer characteristics about the company that weren't explicitly stated. Examples of what NOT to do:
- Do not describe a company as "lean", "agile", or "fast-moving" based on headcount alone — only use their own words if they've used them
- Do not attribute priorities or values to a contact based on their job title — only based on what they said or demonstrably published
- Do not present assumptions as facts. If a claim isn't grounded, cut it rather than soften it

If a claim can't be sourced to meeting notes or verified research, omit it. A shorter, accurate sentence is worth more than a confident-sounding one that misrepresents the company.

Voice rules — non-negotiable:
- Direct, human, evidence-led. Australian English.
- No corporate filler. No "leading provider", "in today's competitive landscape", "robust solutions".
- No "quietly", no "it's not X, it's Y" constructions, no "actually".
- Specific over generic, always. Reference real things from research/notes.
- Refer to the business as "Positive" — not "Positive Salary Packaging" (too formal) and never "PSP".
- Match the template's existing tone (warm, confident, plain-spoken).

Propositions should be the 2 strongest reasons Positive is right for THIS employer based on what you learn. Not generic Positive benefits. Heading is 3-6 words, punchy. Body is 2-3 sentences, concrete.

RATIONALE — REQUIRED FOR EVERY templateContent FIELD:
Each piece of generated copy must include a companion rationale field. The rationale:
- States the specific source for every claim (meeting notes: "they said X" / search: "their website states Y")
- Flags if any part relies on inference rather than explicit evidence
- Is 2-3 sentences max — it's for internal review before the proposal sends, not for the prospect
- Gives the RDM enough to quickly verify the copy or ask for a change with context

Return ONLY valid JSON. No prose before or after. No code fences.`

function buildResearchPrompt({ companyName, primaryContactName, primaryContactRole, otherContacts, meetingNotes, focusAreas }) {
  return `COMPANY: ${companyName}

PRIMARY CONTACT (recipient of proposal):
${primaryContactName} — ${primaryContactRole}

${otherContacts ? `OTHER STAKEHOLDERS (research these too, but proposal is addressed to primary contact):\n${otherContacts}\n` : ""}

MEETING / PROFILE NOTES:
${meetingNotes}

${focusAreas ? `FOCUS AREAS / ANGLES TO WEIGHT:\n${focusAreas}\n` : ""}

Research the company and the contacts via web search. Look for:
- Company industry, size, locations, recent news, current employee benefits
- Anything about EVs, sustainability, fleet, or employee experience programs
- Each contact's role, background, posted content, professional priorities

Then produce content for the template. Return JSON with this exact shape:

{
  "research": {
    "companySnapshot": "3-4 sentences describing the company based on what you found. Industry, size estimate, locations, anything notable. This is internal context, not for the proposal.",
    "contactIntelligence": [
      { "name": "Contact name", "role": "Their role", "insights": "2-3 sentences on their background, priorities, and communication-style cues." }
    ],
    "keyInsights": [
      "Specific things you found that should shape the proposal — recent news, posted content, stated priorities, things from meeting notes worth amplifying."
    ],
    "sources": [
      "Brief notes on what was found via search and where."
    ]
  },
  "templateContent": {
    "introPersonalisation": "2-3 sentences for the [[intro-personalisation]] placeholder on page 1. Reflect back what they said and connect it directly to what this proposal does about it. Do NOT narrate the act of listening — no 'that told us something', 'we heard you say', 'it was clear from our conversation'. Just do the thing: here is what you raised, here is what we are proposing to help you with it. Write like a colleague following up after a good meeting, not a marketer proving they took notes. Should flow naturally before the brand boilerplate that follows.",
    "introPersonalisationRationale": "Source each claim: which part came from meeting notes (quote the relevant line) and which from research (cite where). Flag anything that relies on inference rather than direct evidence.",
    "employerContextIntro": "1-2 sentences that go into [[employer context intro]] on page 2. Lead-in to 'Why [Company] + Positive'. Do NOT characterise the company's track record, culture, or operating style unless they stated it themselves in the meeting or it is their own published language. If research surfaces a specific sourced example — a named quote, a documented tool investment, a stated initiative — you may reference that specific thing. Do not extrapolate a single data point into a generalised character claim. 'You have invested in Workday to reduce admin for your people leaders' (sourced, specific) is acceptable. 'You have a clear track record of choosing admin-light solutions' (inferred pattern) is not.",
    "employerContextIntroRationale": "Source each claim explicitly. If you used a specific research finding, quote it and name where it came from. Note clearly if any part of the framing goes beyond what was directly stated or found.",
    "proposition1": {
      "heading": "3-6 word heading. Punchy. No cliches.",
      "body": "2-3 sentences. The strongest reason Positive is right for THIS employer. Reference specifics from research/notes — don't speak in generalities.",
      "rationale": "State the source for every specific claim in the heading and body. Quote the meeting note or cite the search result. Flag any inference."
    },
    "proposition2": {
      "heading": "3-6 word heading. Different angle from proposition 1.",
      "body": "2-3 sentences. The second strongest reason. Concrete.",
      "rationale": "State the source for every specific claim. Quote the meeting note or cite the search result. Flag any inference."
    }
  }
}

Important: the templateContent fields are what goes into the proposal. They must be high-quality, specific, and ready to use as-is. The rationale fields are internal only — they never appear in the proposal. Every claim in the copy must be defensible from the sources you cite in the rationale.`;
}

const GENERATION_SYSTEM = `You are operating the Gamma MCP server to generate a B2B proposal from an existing template. You will receive a template gammaId and a complete map of placeholder values.

The template uses [[placeholder]] convention. Your job is to call the generate_from_template tool with a prompt that instructs Gamma to perform a precise find-and-replace: each placeholder in the template gets replaced with its corresponding value. Do not invent new content. Do not modify the template structure. Do not paraphrase the values — use them verbatim.

After the tool call completes, return the resulting gamma URL on a line by itself. No other text.`;

function buildGenerationPrompt({ templateId, values }) {
  const replacements = Object.entries(values)
    .map(([placeholder, value]) => `${placeholder} → ${JSON.stringify(value)}`)
    .join("\n");

  return `Template gammaId: ${templateId}

Use the generate_from_template tool. The template contains [[placeholder]] variables that must be replaced verbatim with the values below. Do not paraphrase. Do not modify any other content. Do not add or remove sections.

Placeholders and their replacement values:

${replacements}

Pass these explicit find-and-replace instructions to generate_from_template. After it completes, return the gamma URL.`;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE = {
  companyName: "Brunswick Engineering Group",
  primaryContactName: "Sarah Chen",
  primaryContactRole: "Head of People & Culture",
  otherContacts: "Mark Tavita — CFO\nPaul Brennan — CEO (decision sign-off)",
  meetingNotes: `Intro call 30 min. SEG is a 180-person mechanical engineering consultancy across Melbourne and Sydney. Mostly site-based engineers, plus head office staff.

Sarah flagged: retention is biting, especially for mid-level engineers. They lost 3 to a competitor last quarter who offered novated leasing. Current benefits are basic — super, leave loading, nothing exciting.

Mark cautious on cost but open if zero-cost-to-business and admin is genuinely low. Burnt by a previous packaging provider — too much HR admin, slow responses.

They have 12 EV-curious engineers who've asked HR about novated leases for EVs specifically.

Want a proposal back within 2 weeks. Decision-makers are Sarah + Mark, with sign-off from CEO Paul Brennan.`,
  focusAreas:
    "Zero cost to employer. Low admin / dedicated account management (they were burnt by a previous provider). EV Electric Car Discount benefit. Retention/EVP framing.",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProposalForge() {
  const [step, setStep] = useState("input");
  const [inputs, setInputs] = useState({
    companyName: "",
    primaryContactName: "",
    primaryContactRole: "",
    otherContacts: "",
    meetingNotes: "",
    focusAreas: "",
    rdmName: "",
    rdmRole: "",
    rdmPhone: "",
    rdmEmail: "",
    fee: "30",
    date: formatAuDate(),
    templateId: DEFAULT_TEMPLATE_ID,
  });
  const [research, setResearch] = useState(null);
  const [templateContent, setTemplateContent] = useState(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [gammaUrl, setGammaUrl] = useState(null);
  const [showResearch, setShowResearch] = useState(false);

  const update = (k, v) => setInputs((s) => ({ ...s, [k]: v }));

  const canResearch =
    inputs.companyName.trim() &&
    inputs.primaryContactName.trim() &&
    inputs.primaryContactRole.trim() &&
    inputs.meetingNotes.trim() &&
    inputs.rdmName.trim() &&
    inputs.rdmEmail.trim() &&
    inputs.templateId.trim();

  async function runResearch() {
    setError(null);
    setStep("researching");
    setProgress("Searching the web for company info…");
    try {
      // Step 1: web search only — gather raw results, no synthesis
      const searchData = await callClaude({
        system: "You are a research assistant. Use the web_search tool to find information about the company and contacts provided. Search for: the company's website and about page, their industry and size, any recent news, and the LinkedIn profiles or public profiles of the contacts mentioned. Return ALL search results as raw compiled text — do not summarise or analyse yet. Just gather everything you find.",
        messages: [{ role: "user", content: buildResearchPrompt(inputs) }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        max_tokens: 4000,
      });

      const rawResearch = getTextBlocks(searchData) + "\n" + getMcpResults(searchData);

      setProgress("Synthesising brief…");

      // Step 2: synthesise only — no web search, just analyse and produce JSON
      const synthData = await callClaude({
        system: RESEARCH_SYSTEM,
        messages: [{
          role: "user",
          content: `Here are the raw web search results for this account:\n\n${rawResearch}\n\nAnd here are the original inputs:\n\n${buildResearchPrompt(inputs)}\n\nNow synthesise this into the required JSON output.`,
        }],
        tools: [],
        max_tokens: 4000,
      });

      const text = getTextBlocks(synthData);
      const parsed = parseJson(text);
      setResearch(parsed.research);
      setTemplateContent(parsed.templateContent);
      setStep("review");
    } catch (e) {
      console.error(e);
      setError(e.message || "Research failed");
      setStep("input");
    } finally {
      setProgress("");
    }
  }

  async function generateProposal() {
    setError(null);
    setStep("generating");
    setProgress("Sending to Gamma. Generation usually takes 30-90 seconds…");
    try {
      const values = {
        "[[company-name]]": inputs.companyName,
        "[[contact-name]]": inputs.primaryContactName,
        "[[contact-role]]": inputs.primaryContactRole,
        "[[date]]": inputs.date,
        "[[rdm-name]]": inputs.rdmName,
        "[[rdm-role]]": inputs.rdmRole,
        "[[rdm-phone]]": inputs.rdmPhone,
        "[[rdm-email]]": inputs.rdmEmail,
        "[[employer context intro]]": templateContent.employerContextIntro,
        "[[intro-personalisation]]": templateContent.introPersonalisation,
        "[[proposition1-heading]]": templateContent.proposition1.heading,
        "[[proposition1-body]]": templateContent.proposition1.body,
        "[[proposition2-heading]]": templateContent.proposition2.heading,
        "[[proposition2-body]]": templateContent.proposition2.body,
        "[[fee]]": inputs.fee || "30",
      };

      const data = await callClaude({
        system: GENERATION_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt({ templateId: inputs.templateId, values }),
          },
        ],
        mcp_servers: [{ type: "url", url: GAMMA_MCP_URL, name: "gamma" }],
        max_tokens: 3000,
      });
      const text = getTextBlocks(data);
      const mcp = getMcpResults(data);
      const combined = text + "\n" + mcp;
      const url = extractUrl(combined);
      if (!url) {
        throw new Error("Gamma generated but no URL was returned. Check the Gamma app directly.");
      }
      setGammaUrl(url);
      setStep("complete");
    } catch (e) {
      console.error(e);
      setError(e.message || "Generation failed");
      setStep("review");
    } finally {
      setProgress("");
    }
  }

  function reset() {
    const keep = {
      rdmName: inputs.rdmName,
      rdmRole: inputs.rdmRole,
      rdmPhone: inputs.rdmPhone,
      rdmEmail: inputs.rdmEmail,
      fee: inputs.fee,
      templateId: inputs.templateId,
    };
    setInputs({
      companyName: "",
      primaryContactName: "",
      primaryContactRole: "",
      otherContacts: "",
      meetingNotes: "",
      focusAreas: "",
      rdmName: "",
      rdmRole: "",
      rdmPhone: "",
      rdmEmail: "",
      fee: "30",
      date: formatAuDate(),
      templateId: DEFAULT_TEMPLATE_ID,
      ...keep,
    });
    setResearch(null);
    setTemplateContent(null);
    setGammaUrl(null);
    setError(null);
    setProgress("");
    setStep("input");
  }

  function loadSample() {
    setInputs((s) => ({ ...s, ...SAMPLE }));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE,
        color: INK,
        fontFamily: "'Lato', system-ui, sans-serif",
      }}
    >
      <style>{FONT_IMPORTS}</style>
      <style>{`
        body { background: ${PAGE}; }
        ::selection { background: ${BLUE}; color: #fff; }
        .display { font-family: 'Outfit', system-ui, sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        textarea, input { font-family: inherit; }
        textarea:focus, input:focus {
          outline: 2px solid ${BLUE};
          outline-offset: 2px;
          border-color: ${BLUE};
        }
        .fade-in { animation: fadeIn 0.4s ease both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "48px 32px 80px" }}>
        <header style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: INK_SOFT,
              marginBottom: 20,
              padding: "6px 12px",
              background: CARD,
              borderRadius: 999,
              boxShadow: SHADOW_SM,
              fontWeight: 700,
            }}
            className="display"
          >
            <Sparkles size={12} strokeWidth={2} color={BLUE} />
            Proposal Forge · v2
          </div>
          <h1
            className="display"
            style={{
              fontSize: 64,
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 16,
              color: BLUE,
            }}
          >
            Notes in.<br />
            Personalised proposal out.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: INK_SOFT,
              maxWidth: 620,
              margin: 0,
            }}
          >
            Maps research to the 14 placeholders in your Positive proposal template.
            Web-search backed, editable before it touches Gamma, and you see
            exactly what's being injected.
          </p>
        </header>

        <Stepper step={step} />

        {step === "input" && (
          <InputForm
            inputs={inputs}
            update={update}
            onSubmit={runResearch}
            canSubmit={canResearch}
            error={error}
            onSample={loadSample}
          />
        )}

        {(step === "researching" || step === "generating") && (
          <ProgressPanel message={progress} />
        )}

        {(step === "review" || step === "generating" || step === "complete") &&
          templateContent && (
            <ReviewPanel
              inputs={inputs}
              templateContent={templateContent}
              setTemplateContent={setTemplateContent}
              research={research}
              showResearch={showResearch}
              setShowResearch={setShowResearch}
              onGenerate={generateProposal}
              isGenerating={step === "generating"}
              disabled={step !== "review"}
              error={error}
            />
          )}

        {step === "complete" && gammaUrl && (
          <CompletePanel
            url={gammaUrl}
            onReset={reset}
            companyName={inputs.companyName}
          />
        )}

        <footer
          style={{
            marginTop: 80,
            paddingTop: 24,
            borderTop: `1px solid ${BORDER}`,
            fontSize: 12,
            color: INK_SOFT,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          className="mono"
        >
          <span>Positive · Template {DEFAULT_TEMPLATE_ID}</span>
          {step !== "input" && (
            <button
              onClick={reset}
              style={{
                background: "none",
                border: "none",
                color: INK_SOFT,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              <RotateCcw size={12} /> Start over
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({ step }) {
  const order = ["input", "researching", "review", "generating", "complete"];
  const labels = {
    input: "Input",
    researching: "Research",
    review: "Review",
    generating: "Generate",
    complete: "Done",
  };
  const activeIndex = order.indexOf(step);
  return (
    <div
      style={{
        display: "flex",
        marginBottom: 32,
        background: CARD,
        borderRadius: 16,
        boxShadow: SHADOW_SM,
        overflow: "hidden",
      }}
    >
      {order.map((s, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        return (
          <div
            key={s}
            style={{
              flex: 1,
              padding: "16px 14px",
              borderRight: i < order.length - 1 ? `1px solid ${BORDER}` : "none",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: isActive ? BLUE : isPast ? INK : INK_SOFT,
              background: isActive ? BLUE_TINT : "transparent",
              display: "flex",
              alignItems: "center",
              gap: 10,
              transition: "all 0.3s ease",
              fontWeight: isActive ? 700 : 500,
            }}
            className="display"
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: isPast ? "none" : `1.5px solid ${isActive ? BLUE : BORDER}`,
                background: isPast ? LIME : "transparent",
                color: isPast ? DARK : isActive ? BLUE : INK_SOFT,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {isPast ? "✓" : i + 1}
            </span>
            {labels[s]}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input form
// ---------------------------------------------------------------------------

function InputForm({ inputs, update, onSubmit, canSubmit, error, onSample }) {
  return (
    <div
      className="fade-in"
      style={{
        background: CARD,
        borderRadius: 24,
        boxShadow: SHADOW_MD,
        padding: "32px 32px 28px",
      }}
    >
      <SectionLabel icon={<Building2 size={14} />} text="Account" />

      <FieldRow>
        <Field label="Company name" placeholder="[[company-name]]">
          <input
            type="text"
            value={inputs.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            placeholder="e.g. Brunswick Engineering Group"
            style={inputStyle()}
          />
        </Field>
        <Field label="Proposal date" placeholder="[[date]]">
          <input
            type="text"
            value={inputs.date}
            onChange={(e) => update("date", e.target.value)}
            style={inputStyle()}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Primary contact name" placeholder="[[contact-name]]">
          <input
            type="text"
            value={inputs.primaryContactName}
            onChange={(e) => update("primaryContactName", e.target.value)}
            placeholder="e.g. Sarah Chen"
            style={inputStyle()}
          />
        </Field>
        <Field label="Primary contact role" placeholder="[[contact-role]]">
          <input
            type="text"
            value={inputs.primaryContactRole}
            onChange={(e) => update("primaryContactRole", e.target.value)}
            placeholder="e.g. Head of People & Culture"
            style={inputStyle()}
          />
        </Field>
      </FieldRow>

      <Field
        label="Other stakeholders"
        hint="Researched for context but not in the proposal. One per line, Name — Role."
      >
        <textarea
          value={inputs.otherContacts}
          onChange={(e) => update("otherContacts", e.target.value)}
          placeholder={"Optional\nMark Tavita — CFO"}
          rows={2}
          style={inputStyle()}
        />
      </Field>

      <Field
        label="Meeting / profile notes"
        hint="Paste raw notes. The messier and more specific, the better."
      >
        <textarea
          value={inputs.meetingNotes}
          onChange={(e) => update("meetingNotes", e.target.value)}
          placeholder="What they said, what you observed, what they cared about…"
          rows={9}
          style={inputStyle()}
        />
      </Field>

      <Field
        label="Focus areas"
        hint="Optional. Angles to weight in the propositions — zero cost, EV Electric Car Discount, retention, low admin."
      >
        <textarea
          value={inputs.focusAreas}
          onChange={(e) => update("focusAreas", e.target.value)}
          placeholder="Optional"
          rows={2}
          style={inputStyle()}
        />
      </Field>

      <div style={{ height: 8 }} />
      <SectionLabel icon={<UserCircle2 size={14} />} text="Your details (signs the proposal)" />

      <FieldRow>
        <Field label="RDM name" placeholder="[[rdm-name]]">
          <input
            type="text"
            value={inputs.rdmName}
            onChange={(e) => update("rdmName", e.target.value)}
            placeholder="e.g. Adam Smith"
            style={inputStyle()}
          />
        </Field>
        <Field label="RDM role" placeholder="[[rdm-role]]">
          <input
            type="text"
            value={inputs.rdmRole}
            onChange={(e) => update("rdmRole", e.target.value)}
            placeholder="e.g. Relationship & Development Manager"
            style={inputStyle()}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="RDM phone" placeholder="[[rdm-phone]]">
          <input
            type="text"
            value={inputs.rdmPhone}
            onChange={(e) => update("rdmPhone", e.target.value)}
            placeholder="e.g. 0400 000 000"
            style={inputStyle()}
          />
        </Field>
        <Field label="RDM email" placeholder="[[rdm-email]]">
          <input
            type="email"
            value={inputs.rdmEmail}
            onChange={(e) => update("rdmEmail", e.target.value)}
            placeholder="e.g. adam@positivesp.com.au"
            style={inputStyle()}
          />
        </Field>
      </FieldRow>

      <div style={{ height: 8 }} />
      <SectionLabel icon={<FileText size={14} />} text="Commercial & template" />

      <FieldRow>
        <Field label="Management fee ($/month)" placeholder="[[fee]]">
          <input
            type="text"
            value={inputs.fee}
            onChange={(e) => update("fee", e.target.value)}
            placeholder="30"
            style={inputStyle()}
          />
        </Field>
        <Field label="Template ID" hint="Defaults to your Positive proposal template.">
          <input
            type="text"
            value={inputs.templateId}
            onChange={(e) => update("templateId", e.target.value)}
            style={{
              ...inputStyle(),
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
            }}
          />
        </Field>
      </FieldRow>

      {error && <ErrorBanner message={error} />}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 28,
          gap: 16,
        }}
      >
        <button
          onClick={onSample}
          style={{
            background: "transparent",
            boxShadow: `inset 0 0 0 2px ${BLUE}`,
            color: BLUE,
            padding: "12px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Outfit', system-ui, sans-serif",
            border: "none",
            borderRadius: 14,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BLUE_TINT)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          Load sample account
        </button>

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? BLUE : BORDER,
            color: canSubmit ? "#fff" : INK_SOFT,
            border: "none",
            borderRadius: 14,
            padding: "14px 28px",
            fontSize: 15,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "'Outfit', system-ui, sans-serif",
            boxShadow: canSubmit ? SHADOW_SM : "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (canSubmit) e.currentTarget.style.background = BLUE_HOVER;
          }}
          onMouseLeave={(e) => {
            if (canSubmit) e.currentTarget.style.background = BLUE;
          }}
        >
          <Search size={16} />
          Research & synthesise
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        marginBottom: 18,
        paddingBottom: 10,
        borderBottom: `1px solid ${BORDER}`,
        color: INK,
      }}
    >
      <span style={{ color: BLUE, display: "flex" }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: INK,
        }}
        className="display"
      >
        {text}
      </span>
    </div>
  );
}

function FieldRow({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, hint, placeholder, children }) {
  return (
    <label style={{ display: "block", marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: INK,
          fontWeight: 700,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
        className="display"
      >
        <span>{label}</span>
        {placeholder && (
          <span
            style={{
              color: INK_SOFT,
              fontWeight: 500,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: 0,
              textTransform: "none",
            }}
          >
            {placeholder}
          </span>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 13, color: INK_SOFT, marginBottom: 8, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    width: "100%",
    background: "#fff",
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: "11px 13px",
    fontSize: 14,
    color: INK,
    boxSizing: "border-box",
    resize: "vertical",
    lineHeight: 1.5,
    fontFamily: "'Lato', system-ui, sans-serif",
    transition: "border-color 0.15s",
  };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

function ProgressPanel({ message }) {
  return (
    <div
      className="fade-in"
      style={{
        padding: "56px 32px",
        textAlign: "center",
        background: CARD,
        borderRadius: 24,
        boxShadow: SHADOW_MD,
      }}
    >
      <Loader2
        size={28}
        style={{ animation: "spin 1.4s linear infinite", color: BLUE, marginBottom: 16 }}
      />
      <p style={{ fontSize: 14, color: INK_SOFT, margin: 0 }}>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review — shows what's actually going into each placeholder
// ---------------------------------------------------------------------------

function ReviewPanel({
  inputs,
  templateContent,
  setTemplateContent,
  research,
  showResearch,
  setShowResearch,
  onGenerate,
  isGenerating,
  disabled,
  error,
}) {
  const updateTC = (path, value) => {
    setTemplateContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (path.length === 1) next[path[0]] = value;
      if (path.length === 2) next[path[0]][path[1]] = value;
      return next;
    });
  };

  return (
    <div
      className="fade-in"
      style={{
        marginTop: 32,
        background: CARD,
        borderRadius: 24,
        boxShadow: SHADOW_MD,
        padding: "28px 32px 32px",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          background: BLUE_TINT,
          borderRadius: 16,
          marginBottom: 28,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: BLUE,
            marginBottom: 10,
            fontWeight: 700,
          }}
          className="display"
        >
          Identity placeholders
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
          <IdentityRow label="[[company-name]]" value={inputs.companyName} />
          <IdentityRow label="[[date]]" value={inputs.date} />
          <IdentityRow label="[[contact-name]]" value={inputs.primaryContactName} />
          <IdentityRow label="[[contact-role]]" value={inputs.primaryContactRole} />
          <IdentityRow label="[[rdm-name]]" value={inputs.rdmName} />
          <IdentityRow label="[[rdm-role]]" value={inputs.rdmRole} />
          <IdentityRow label="[[rdm-phone]]" value={inputs.rdmPhone} />
          <IdentityRow label="[[rdm-email]]" value={inputs.rdmEmail} />
          <IdentityRow label="[[fee]]" value={`$${inputs.fee || "30"}/month`} />
        </div>
      </div>

      <PlaceholderBlock
        placeholder="[[intro-personalisation]]"
        title="Page 1 — personalised opener"
        subtitle="Where you prove you listened. Sits inside the cover letter on page 1, before the brand messaging."
      >
        <EditableText
          value={templateContent.introPersonalisation}
          onChange={(v) => updateTC(["introPersonalisation"], v)}
          rows={4}
          disabled={disabled}
        />
        <RationaleToggle rationale={templateContent.introPersonalisationRationale} />
      </PlaceholderBlock>

      <PlaceholderBlock
        placeholder="[[employer context intro]]"
        title="Page 2 — strategic intro"
        subtitle="The lead paragraph on slide 2 (Why [Company] + Positive)."
      >
        <EditableText
          value={templateContent.employerContextIntro}
          onChange={(v) => updateTC(["employerContextIntro"], v)}
          rows={3}
          disabled={disabled}
        />
        <RationaleToggle rationale={templateContent.employerContextIntroRationale} />
      </PlaceholderBlock>

      <PlaceholderBlock
        placeholder="[[proposition1-heading]] + [[proposition1-body]]"
        title="Proposition 1"
        subtitle="The strongest reason Positive is right for this employer."
      >
        <input
          type="text"
          value={templateContent.proposition1.heading}
          onChange={(e) => updateTC(["proposition1", "heading"], e.target.value)}
          disabled={disabled}
          style={{
            ...inputStyle(),
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 8,
            background: disabled ? PAGE : "#fff",
            fontFamily: "'Outfit', system-ui, sans-serif",
            color: BLUE,
          }}
          placeholder="Heading"
        />
        <EditableText
          value={templateContent.proposition1.body}
          onChange={(v) => updateTC(["proposition1", "body"], v)}
          rows={3}
          disabled={disabled}
        />
        <RationaleToggle rationale={templateContent.proposition1?.rationale} />
      </PlaceholderBlock>

      <PlaceholderBlock
        placeholder="[[proposition2-heading]] + [[proposition2-body]]"
        title="Proposition 2"
        subtitle="A different angle from proposition 1."
      >
        <input
          type="text"
          value={templateContent.proposition2.heading}
          onChange={(e) => updateTC(["proposition2", "heading"], e.target.value)}
          disabled={disabled}
          style={{
            ...inputStyle(),
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 8,
            background: disabled ? PAGE : "#fff",
            fontFamily: "'Outfit', system-ui, sans-serif",
            color: BLUE,
          }}
          placeholder="Heading"
        />
        <EditableText
          value={templateContent.proposition2.body}
          onChange={(v) => updateTC(["proposition2", "body"], v)}
          rows={3}
          disabled={disabled}
        />
        <RationaleToggle rationale={templateContent.proposition2?.rationale} />
      </PlaceholderBlock>

      {research && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowResearch(!showResearch)}
            style={{
              background: "none",
              border: "none",
              color: BLUE,
              cursor: "pointer",
              padding: "12px 0",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Outfit', system-ui, sans-serif",
            }}
          >
            {showResearch ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Research context (not in proposal)
          </button>
          {showResearch && (
            <div
              style={{
                padding: "18px 20px",
                background: PAGE,
                borderRadius: 16,
                fontSize: 13,
                lineHeight: 1.6,
                color: INK,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <strong
                  className="display"
                  style={{ display: "block", marginBottom: 4, color: BLUE, fontWeight: 700 }}
                >
                  Company snapshot
                </strong>
                <span style={{ color: INK_SOFT }}>{research.companySnapshot}</span>
              </div>
              {(research.contactIntelligence || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong
                    className="display"
                    style={{ display: "block", marginBottom: 4, color: BLUE, fontWeight: 700 }}
                  >
                    Contacts
                  </strong>
                  {research.contactIntelligence.map((c, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: INK }}>{c.name}</span>
                      <span style={{ color: INK_SOFT }}> — {c.role}</span>
                      <div style={{ color: INK_SOFT, marginTop: 2 }}>{c.insights}</div>
                    </div>
                  ))}
                </div>
              )}
              {(research.keyInsights || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong
                    className="display"
                    style={{ display: "block", marginBottom: 4, color: BLUE, fontWeight: 700 }}
                  >
                    Key insights
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: INK_SOFT }}>
                    {research.keyInsights.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {(research.sources || []).length > 0 && (
                <div>
                  <strong
                    className="display"
                    style={{ display: "block", marginBottom: 4, color: BLUE, fontWeight: 700 }}
                  >
                    Sources
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 18, color: INK_SOFT, fontSize: 12 }}>
                    {research.sources.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {!disabled && (
        <div
          style={{
            marginTop: 28,
            padding: "16px 20px",
            background: LIME_TINT,
            borderRadius: 16,
            fontSize: 14,
            lineHeight: 1.55,
            color: INK,
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 999,
              background: LIME,
              color: DARK,
              fontWeight: 800,
              flexShrink: 0,
              fontSize: 14,
            }}
          >
            ✓
          </span>
          <span>
            Last sanity check before Gamma. What's in the boxes above is exactly
            what gets injected. Read it back as the recipient — does it sound
            like a real human who paid attention in your meeting?
          </span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button
          onClick={onGenerate}
          disabled={isGenerating || disabled}
          style={{
            background: isGenerating || disabled ? BORDER : BLUE,
            color: isGenerating || disabled ? INK_SOFT : "#fff",
            border: "none",
            borderRadius: 14,
            padding: "14px 28px",
            fontSize: 15,
            fontWeight: 700,
            cursor: isGenerating ? "wait" : disabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "'Outfit', system-ui, sans-serif",
            boxShadow: !isGenerating && !disabled ? SHADOW_SM : "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isGenerating && !disabled) e.currentTarget.style.background = BLUE_HOVER;
          }}
          onMouseLeave={(e) => {
            if (!isGenerating && !disabled) e.currentTarget.style.background = BLUE;
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Generating in Gamma…
            </>
          ) : (
            <>
              <Send size={16} />
              Generate proposal in Gamma
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function IdentityRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span
        style={{
          color: INK_SOFT,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          minWidth: 130,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: INK, fontWeight: 700 }}>
        {value || <em style={{ color: ERROR, fontWeight: 500, fontStyle: "normal" }}>—missing—</em>}
      </span>
    </div>
  );
}

function PlaceholderBlock({ placeholder, title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
          paddingBottom: 8,
          borderBottom: `1px solid ${BORDER}`,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3
          className="display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.01em",
            color: BLUE,
          }}
        >
          {title}
        </h3>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: INK_SOFT,
            letterSpacing: "0.02em",
          }}
        >
          {placeholder}
        </span>
      </div>
      <p style={{ fontSize: 13, color: INK_SOFT, margin: "6px 0 12px", lineHeight: 1.5 }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function RationaleToggle({ rationale }) {
  const [open, setOpen] = useState(false);
  if (!rationale) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none",
          border: "none",
          color: INK_SOFT,
          cursor: "pointer",
          padding: "4px 0",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          fontFamily: "'Outfit', system-ui, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Why this?
      </button>
      {open && (
        <div
          style={{
            marginTop: 6,
            padding: "12px 14px",
            background: BLUE_TINT,
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.55,
            color: INK_SOFT,
          }}
        >
          {rationale}
        </div>
      )}
    </div>
  );
}

function EditableText({ value, onChange, rows, disabled }) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      disabled={disabled}
      style={{
        ...inputStyle(),
        background: disabled ? PAGE : "#fff",
        opacity: disabled ? 0.85 : 1,
        cursor: disabled ? "default" : "text",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

function CompletePanel({ url, onReset, companyName }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div
      className="fade-in"
      style={{
        marginTop: 32,
        padding: "32px 36px",
        background: CARD,
        borderRadius: 24,
        boxShadow: SHADOW_LG,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
          padding: "6px 12px 6px 8px",
          background: LIME_TINT,
          borderRadius: 999,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 999,
            background: LIME,
            color: DARK,
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          ✓
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: DARK,
          }}
          className="display"
        >
          Proposal ready
        </span>
      </div>
      <h2
        className="display"
        style={{
          fontSize: 32,
          fontWeight: 800,
          margin: 0,
          marginBottom: 10,
          letterSpacing: "-0.01em",
          color: BLUE,
          lineHeight: 1.15,
        }}
      >
        Open in Gamma to review and send to {companyName}.
      </h2>
      <p
        style={{
          color: INK_SOFT,
          fontSize: 15,
          margin: 0,
          marginBottom: 24,
          lineHeight: 1.55,
        }}
      >
        Always read end-to-end before sending. Check every placeholder got
        replaced and the propositions land the way you wanted.
      </p>

      <div
        style={{
          padding: "14px 16px",
          background: PAGE,
          borderRadius: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          wordBreak: "break-all",
          marginBottom: 20,
          color: INK,
        }}
      >
        {url}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: BLUE,
            color: "#fff",
            padding: "12px 22px",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            borderRadius: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'Outfit', system-ui, sans-serif",
            boxShadow: SHADOW_SM,
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BLUE_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.background = BLUE)}
        >
          Open in Gamma <ExternalLink size={14} />
        </a>
        <button
          onClick={copy}
          style={{
            background: "transparent",
            boxShadow: `inset 0 0 0 2px ${BLUE}`,
            color: BLUE,
            padding: "12px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Outfit', system-ui, sans-serif",
            border: "none",
            borderRadius: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = BLUE_TINT)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Copy size={14} /> {copied ? "Copied" : "Copy link"}
        </button>
        <button
          onClick={onReset}
          style={{
            background: "transparent",
            border: "none",
            color: INK_SOFT,
            padding: "12px 16px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            textDecorationThickness: 1.5,
          }}
        >
          <RotateCcw size={14} /> Run another (keep RDM details)
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function ErrorBanner({ message }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        background: "#FFF7F6",
        borderRadius: 12,
        borderLeft: `4px solid ${ERROR}`,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        fontSize: 13.5,
        color: INK,
        lineHeight: 1.5,
      }}
    >
      <AlertCircle size={18} style={{ color: ERROR, flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong style={{ fontWeight: 700 }}>Something went wrong.</strong> {message}
      </div>
    </div>
  );
}
