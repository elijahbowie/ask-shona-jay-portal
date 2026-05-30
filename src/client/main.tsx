import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpenText,
  CaretLeft,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  Database,
  DownloadSimple,
  FileText,
  Gauge,
  Heartbeat,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  Microphone,
  PaperPlaneTilt,
  ShieldCheck,
  SignOut,
  Sparkle,
  ThumbsDown,
  ThumbsUp,
  TrendUp,
  UploadSimple,
  UserCircle,
  WarningCircle
} from "@phosphor-icons/react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { AppMe, ChatAnswer, DashboardData, DownloadAsset, PlanItem, TrainingRecommendation, WikiPage } from "../shared/types";
import "./styles.css";

gsap.registerPlugin(ScrollTrigger);

type ApiError = { error: string };

type ConversationEntry = {
  id: string;
  question: string;
  answer: ChatAnswer;
  createdAt: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const data = (await response.json().catch(() => ({}))) as T | ApiError;
  if (!response.ok) {
    throw new Error(isApiError(data) ? data.error : `Request failed with ${response.status}`);
  }
  return data as T;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as ApiError).error === "string";
}

function App() {
  const [me, setMe] = useState<AppMe | null>(null);
  const [path, setPath] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    api<AppMe>("/api/me")
      .then(setMe)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = titleForPath(path);
    if (mainRef.current && me?.authenticated) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [path, me?.authenticated]);

  useEffect(() => {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      return;
    }
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".motion-in");
      gsap.fromTo(
        targets,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.48, stagger: 0.035, ease: "power3.out" }
      );
    });

    return () => ctx.revert();
  }, [path, me?.authenticated]);

  const navigate = (next: string) => {
    window.history.pushState({}, "", next);
    setPath(next);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!me?.authenticated) {
    return <LoginScreen onLogin={setMe} />;
  }

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    setMe({ authenticated: false, role: null, client: null, adminEmail: null });
    navigate("/");
  };

  const isAdmin = me.role === "admin";

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div aria-live="polite" className="sr-only">{announcement}</div>
      <main id="main-content" ref={mainRef} tabIndex={-1} className={`app-shell ${isAdmin ? "admin-shell" : "client-shell"}`}>
        <TopNav me={me} path={path} navigate={navigate} logout={logout} />
        {isAdmin ? (
          <AdminRouter path={path} navigate={navigate} />
        ) : (
          <>
            <ClientRouter me={me} path={path} navigate={navigate} logout={logout} announce={setAnnouncement} />
            <BottomNav path={path} navigate={navigate} />
          </>
        )}
      </main>
    </>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="orbital-mark">
        <Sparkle size={28} weight="light" />
      </div>
      <p>Opening Ask Shona/Jay</p>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (me: AppMe) => void }) {
  const [email, setEmail] = useState(() => (window.location.hostname === "localhost" ? "client@example.com" : ""));
  const [code, setCode] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [remember, setRemember] = useState(true);
  const isAdminPreview = window.location.pathname.startsWith("/admin");

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ ok: boolean; expiresAt: string; devCode?: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setDevCode(result.devCode || null);
      setStep("code");
      setMessage(result.devCode ? `Development code: ${result.devCode}` : "Check your email for a 6-digit login code.");
      if (result.devCode) {
        setCode(result.devCode);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send login code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<AppMe>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code, remember })
      });
      onLogin(result);
      window.history.replaceState({}, "", result.role === "admin" ? "/admin/review" : "/ask");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to verify code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyAdminPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api<AppMe>("/api/auth/admin-password", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword })
      });
      onLogin(result);
      window.history.replaceState({}, "", "/admin/review");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enter admin preview.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-hero motion-in">
        <div className="brand-pill">
          <ShieldCheck size={18} weight="light" />
          Beyond Freedom Financial
        </div>
        <h1>Tax strategy guidance with receipts.</h1>
        <p>
          Ask Shona/Jay turns approved education into clear answers, source links, and team review when the facts need a human.
        </p>
        <div className="brand-signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="login-card-shell motion-in">
        <div className="login-card">
          <div className="card-heading">
            <LockKey size={26} weight="light" />
            <div>
              <h2>{isAdminPreview ? "Admin preview" : "Secure portal login"}</h2>
              <p>{isAdminPreview ? "Use the shared preview password to review the knowledge console." : "Start with your client email. We only show the code step after your email is accepted."}</p>
            </div>
          </div>
          {isAdminPreview ? (
            <form onSubmit={verifyAdminPassword} className="stack">
              <label>
                Master password
                <input value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} type="password" autoComplete="current-password" />
              </label>
              <button className="primary-button" type="submit" disabled={busy || adminPassword.length < 1}>
                <span>{busy ? "Opening" : "Enter admin preview"}</span>
                <span className="button-orb"><ArrowRight size={17} /></span>
              </button>
            </form>
          ) : step === "email" ? (
            <form onSubmit={requestCode} className="stack">
              <label>
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" />
              </label>
              <label className="check-control">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Keep me signed in for 30 days on this device.</span>
              </label>
              <button className="primary-button" type="submit" disabled={busy || !email.includes("@")}>
                <span>{busy ? "Sending" : "Send secure code"}</span>
                <span className="button-orb"><ArrowRight size={17} /></span>
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="stack">
              <label>
                6-digit code
                <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
              </label>
              <button className="primary-button" type="submit" disabled={busy || code.length < 4}>
                <span>Enter portal</span>
                <span className="button-orb"><ArrowRight size={17} /></span>
              </button>
              <button className="text-button" type="button" onClick={() => setStep("email")}>Use a different email</button>
            </form>
          )}
          {message ? <p className="notice">{message}</p> : null}
          {devCode ? <p className="microcopy">Local development shows the code so the full login workflow is testable.</p> : null}
          <p className="trust-footer">Your data is encrypted in transit and shown only inside the Beyond Freedom Financial portal. Shona and Jay review client-specific questions before action.</p>
        </div>
      </section>
    </main>
  );
}

function TopNav({
  me,
  path,
  navigate,
  logout
}: {
  me: AppMe;
  path: string;
  navigate: (path: string) => void;
  logout: () => void;
}) {
  const clientItems = [
    ["/ask", "Ask", <Sparkle size={17} weight="light" />],
    ["/learn", "Learn", <BookOpenText size={17} weight="light" />],
    ["/my-plan", "My Plan", <ListChecks size={17} weight="light" />],
    ["/more", "More", <UserCircle size={17} weight="light" />]
  ] as const;
  const adminItems = [
    ["/admin/review", "Review", <Gauge size={17} weight="light" />],
    ["/admin/sources", "Sources", <UploadSimple size={17} weight="light" />],
    ["/admin/wiki", "Wiki", <FileText size={17} weight="light" />],
    ["/admin/questions", "Questions", <PaperPlaneTilt size={17} weight="light" />],
    ["/admin/health", "Health", <Heartbeat size={17} weight="light" />],
    ["/admin/settings", "Settings", <Database size={17} weight="light" />]
  ] as const;
  const items = me.role === "admin" ? adminItems : clientItems;

  return (
    <nav className="top-nav motion-in" aria-label="Primary">
      <button className="wordmark" onClick={() => navigate(me.role === "admin" ? "/admin/review" : "/ask")}>
        <span className="wordmark-mark" aria-hidden="true">BF</span>
        <span>Ask Shona/Jay</span>
      </button>
      <div className="nav-links">
        {items.map(([href, label, icon]) => (
          <button key={href} className={isActive(path, href) ? "active" : ""} onClick={() => navigate(href)}>
            {icon}
            {label}
          </button>
        ))}
      </div>
      <button className="logout-button" onClick={logout} aria-label="Sign out">
        <SignOut size={18} weight="light" />
      </button>
    </nav>
  );
}

function BottomNav({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const items = [
    ["/ask", "Ask", <Sparkle size={22} weight="light" />],
    ["/learn", "Learn", <BookOpenText size={22} weight="light" />],
    ["/my-plan", "My Plan", <ListChecks size={22} weight="light" />],
    ["/more", "More", <UserCircle size={22} weight="light" />]
  ] as const;
  return (
    <nav className="bottom-tabs" aria-label="Client tabs">
      {items.map(([href, label, icon]) => (
        <button key={href} className={isActive(path, href) ? "active" : ""} onClick={() => navigate(href)}>
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ClientRouter({
  me,
  path,
  navigate,
  logout,
  announce
}: {
  me: AppMe;
  path: string;
  navigate: (path: string) => void;
  logout: () => void;
  announce: (message: string) => void;
}) {
  if (path.startsWith("/learn/") || path.startsWith("/trainings/")) {
    return <TrainingDetail slug={path.split("/").pop() || ""} navigate={navigate} announce={announce} />;
  }
  if (path === "/learn" || path === "/trainings") {
    return <TrainingVault navigate={navigate} />;
  }
  if (path === "/my-plan" || path === "/plan") {
    return <PlanView announce={announce} />;
  }
  if (path === "/history") {
    return <HistoryView me={me} navigate={navigate} />;
  }
  if (path === "/more" || path === "/account") {
    return <MoreView me={me} navigate={navigate} logout={logout} />;
  }
  return <AskView me={me} announce={announce} navigate={navigate} />;
}

function AskView({ me, announce, navigate }: { me: AppMe; announce: (message: string) => void; navigate: (path: string) => void }) {
  const clientId = me.client?.id || "anonymous";
  const historyKey = `ask-history:${clientId}`;
  const draftKey = `ask-draft:${clientId}`;
  const [question, setQuestion] = useState(() => sessionStorage.getItem(draftKey) || "");
  const [history, setHistory] = useState<ConversationEntry[]>(() => readStorage<ConversationEntry[]>(historyKey, []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [builderCategory, setBuilderCategory] = useState("Tax Deadlines");
  const prompts = useMemo(() => suggestedPrompts(me), [me]);
  const score = useMemo(() => readinessScore(me, history), [me, history]);
  const deadline = useMemo(() => nextDeadline(), []);
  const latest = history[0];

  useEffect(() => {
    sessionStorage.setItem(draftKey, question);
  }, [draftKey, question]);

  useEffect(() => {
    writeStorage(historyKey, history.slice(0, 20));
  }, [history, historyKey]);

  const submit = async (event?: React.FormEvent, override?: string) => {
    event?.preventDefault();
    const currentQuestion = (override || question).trim();
    if (!currentQuestion) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<ChatAnswer>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: currentQuestion })
      });
      const entry = { id: crypto.randomUUID(), question: currentQuestion, answer: result, createdAt: new Date().toISOString() };
      setHistory((items) => [entry, ...items].slice(0, 20));
      setQuestion("");
      sessionStorage.removeItem(draftKey);
      announce("Answer added with citations and next steps.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer right now.");
    } finally {
      setBusy(false);
    }
  };

  const escalate = async (entry: ConversationEntry) => {
    await api("/api/escalations", {
      method: "POST",
      body: JSON.stringify({
        conversationId: entry.answer.conversationId,
        question: entry.question,
        reason: entry.answer.escalationReason || "Client requested personal team review."
      })
    });
    setHistory((items) =>
      items.map((item) =>
        item.id === entry.id
          ? { ...item, answer: { ...item.answer, escalationRequired: true, state: "escalated_to_team", escalationReason: "Sent to Shona's team for review." } }
          : item
      )
    );
    announce("Sent to Shona's team for review.");
  };

  const sendFeedback = async (entry: ConversationEntry, rating: "up" | "down") => {
    await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ conversationId: entry.answer.conversationId, rating, category: "answer_quality" })
    });
    announce(rating === "up" ? "Thanks. Feedback saved." : "Thanks. Shona's team can use that to improve the portal.");
  };

  return (
    <section className="page-grid ask-layout">
      <div className="page-intro motion-in">
        <p className="eyebrow">Ask Shona/Jay</p>
        <h1>Start with the question you would bring to the call.</h1>
        <p>
          The assistant searches approved education, cites its sources, and asks for team review when the answer depends on your facts.
        </p>
        <div className="context-strip">
          <span>{me.client?.name || me.client?.email || "Client"}</span>
          <span>{friendlyEntity(me.client?.entityType)}</span>
          <span>{(me.client?.tags || []).slice(0, 2).map(readable).join(" / ") || "profile-based guidance"}</span>
        </div>
      </div>

      <aside className="ask-side motion-in">
        <DeadlineBanner deadline={deadline} onUse={() => setQuestion("What should I do before estimated taxes are due?")} />
        <ReadinessCard score={score} />
        <MemoryCard history={history} />
      </aside>

      <div className="ask-panel-shell motion-in">
        <div className="ask-panel">
          <WelcomePrompt me={me} prompts={prompts} onPick={setQuestion} />
          <PromptBuilder active={builderCategory} setActive={setBuilderCategory} onPick={setQuestion} />
          <form className="ask-form" onSubmit={submit}>
            <label htmlFor="question">Or type your own question</label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: I have two kids and an S-corp. What should I understand before using the hire-your-kids strategy?"
            />
            <div className="ask-actions">
              <VoiceButton onTranscript={(text) => setQuestion((current) => `${current}${current ? " " : ""}${text}`.trim())} />
              <button className="primary-button ask-submit" type="submit" disabled={busy}>
                <span>{busy ? "Searching approved sources" : "Ask Shona/Jay"}</span>
                <span className="button-orb"><PaperPlaneTilt size={17} /></span>
              </button>
            </div>
          </form>
          <RecentQuestions history={history} onPick={setQuestion} />
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>

      <AnswerThread
        busy={busy}
        history={history}
        latest={latest}
        onEscalate={escalate}
        onFeedback={sendFeedback}
        onFollowUp={(prompt) => submit(undefined, prompt)}
        navigate={navigate}
      />
    </section>
  );
}

function WelcomePrompt({ me, prompts, onPick }: { me: AppMe; prompts: string[]; onPick: (prompt: string) => void }) {
  return (
    <section className="welcome-card">
      <div>
        <span className="mini-label">Welcome back</span>
        <h2>{me.client?.name || "Beyond Freedom client"}</h2>
        <p>{friendlyEntity(me.client?.entityType)} guidance with {me.client?.tier || "active"} access.</p>
      </div>
      <div className="prompt-cards">
        {prompts.slice(0, 3).map((prompt) => (
          <button key={prompt} onClick={() => onPick(prompt)}>{prompt}</button>
        ))}
      </div>
    </section>
  );
}

const promptGroups: Record<string, string[]> = {
  "My Business": [
    "What should I document before reimbursing myself from the business?",
    "Which business expenses usually need more proof before Shona reviews them?"
  ],
  "My Family": [
    "Should I explore hiring my kids, and what facts should I gather first?",
    "What family-related tax strategy questions should I bring to my next call?"
  ],
  "Tax Deadlines": [
    "What should I do before estimated taxes are due?",
    "What should I review 30 days before a tax deadline?"
  ],
  Savings: [
    "What strategies in my profile might need more documentation?",
    "Where could I be leaving tax savings on the table?"
  ],
  Hiring: [
    "Should I classify this worker as a contractor?",
    "What should I confirm before putting family members on payroll?"
  ],
  "Home Office": [
    "What documents should I gather for business use of home?",
    "How do I document an Augusta Rule rental?"
  ]
};

function PromptBuilder({
  active,
  setActive,
  onPick
}: {
  active: string;
  setActive: (category: string) => void;
  onPick: (prompt: string) => void;
}) {
  return (
    <section className="guided-builder" aria-label="Guided prompt builder">
      <div className="builder-tabs">
        {Object.keys(promptGroups).map((category) => (
          <button key={category} className={active === category ? "active" : ""} onClick={() => setActive(category)}>
            {category}
          </button>
        ))}
      </div>
      <div className="builder-prompts">
        {promptGroups[active].map((prompt) => (
          <button key={prompt} onClick={() => onPick(prompt)}>{prompt}</button>
        ))}
      </div>
    </section>
  );
}

function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  if (!supported) {
    return null;
  }

  const toggle = () => {
    const ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!ctor) {
      return;
    }
    const recognition = new ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((item) => item.transcript)
        .join(" ")
        .trim();
      if (transcript) {
        onTranscript(transcript);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  return (
    <button className={`voice-button ${listening ? "listening" : ""}`} type="button" onClick={toggle}>
      <Microphone size={18} weight="light" />
      <span>{listening ? "Listening" : "Voice note"}</span>
      {listening ? <i aria-hidden="true" /> : null}
    </button>
  );
}

function DeadlineBanner({ deadline, onUse }: { deadline: { label: string; days: number }; onUse: () => void }) {
  return (
    <article className="deadline-card">
      <Clock size={22} weight="light" />
      <div>
        <span className="mini-label">Next tax moment</span>
        <h2>{deadline.label}</h2>
        <p>{deadline.days} days away. Start with a readiness question before the week gets loud.</p>
      </div>
      <button onClick={onUse}>Ask about this</button>
    </article>
  );
}

function ReadinessCard({ score }: { score: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="readiness-card">
      <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}>
        <strong>{score}</strong>
        <span>ready</span>
      </div>
      <div>
        <h2>Tax readiness</h2>
        <p>{score >= 75 ? "Your profile has helpful context. Keep documentation current." : "A few facts would make answers more useful."}</p>
        <button className="text-button" onClick={() => setOpen((value) => !value)}>{open ? "Hide details" : "Why this score?"}</button>
      </div>
      {open ? (
        <p className="readiness-detail">Score reflects portal profile context, completed plan items, and recent use of cited answers. It is a planning signal, not a qualification decision.</p>
      ) : null}
    </article>
  );
}

function MemoryCard({ history }: { history: ConversationEntry[] }) {
  return (
    <article className="memory-card">
      <ClockCounterClockwise size={22} weight="light" />
      <div>
        <span className="mini-label">Conversation memory</span>
        <h2>{history.length ? `${history.length} saved questions` : "No saved questions yet"}</h2>
        <p>The portal remembers recent questions on this device so follow-ups stay easy.</p>
      </div>
    </article>
  );
}

function RecentQuestions({ history, onPick }: { history: ConversationEntry[]; onPick: (question: string) => void }) {
  const recent = history.slice(0, 3);
  if (!recent.length) {
    return null;
  }
  return (
    <section className="recent-questions">
      <span className="mini-label">Recent questions</span>
      {recent.map((entry) => (
        <button key={entry.id} onClick={() => onPick(entry.question)}>{entry.question}</button>
      ))}
    </section>
  );
}

function AnswerThread({
  busy,
  history,
  latest,
  onEscalate,
  onFeedback,
  onFollowUp,
  navigate
}: {
  busy: boolean;
  history: ConversationEntry[];
  latest?: ConversationEntry;
  onEscalate: (entry: ConversationEntry) => void;
  onFeedback: (entry: ConversationEntry, rating: "up" | "down") => void;
  onFollowUp: (prompt: string) => void;
  navigate: (path: string) => void;
}) {
  if (busy) {
    return (
      <div className="answer-panel-shell motion-in">
        <div className="answer-panel stack-card">
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      </div>
    );
  }
  if (!history.length || !latest) {
    return (
      <div className="answer-panel-shell motion-in">
        <div className="answer-panel empty-answer stack-card">
          <MagnifyingGlass size={32} weight="light" />
          <h2>Source-backed answers appear here.</h2>
          <p>Ask a question and the portal will show citations, relevant lessons, next steps, and when to bring the team in.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="answer-panel-shell motion-in">
      <div className="answer-thread">
        {history.slice(0, 5).map((entry) => (
          <AnswerCard
            key={entry.id}
            entry={entry}
            isLatest={entry.id === latest.id}
            onEscalate={() => onEscalate(entry)}
            onFeedback={(rating) => onFeedback(entry, rating)}
            onFollowUp={onFollowUp}
            navigate={navigate}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerCard({
  entry,
  isLatest,
  onEscalate,
  onFeedback,
  onFollowUp,
  navigate
}: {
  entry: ConversationEntry;
  isLatest: boolean;
  onEscalate: () => void;
  onFeedback: (rating: "up" | "down") => void;
  onFollowUp: (prompt: string) => void;
  navigate: (path: string) => void;
}) {
  const answer = entry.answer;
  const followUps = followUpPrompts(entry.question, answer);
  return (
    <article className={`answer-panel stack-card ${isLatest ? "latest-answer" : ""}`}>
      <div className="answer-topline">
        <div className={`status-chip ${answer.escalationRequired ? "review" : "clear"}`}>
          {answer.escalationRequired ? <WarningCircle size={16} /> : <CheckCircle size={16} />}
          {readableState(answer.state)}
        </div>
        <span className="freshness-badge">Beyond Freedom curriculum</span>
      </div>
      <div className="question-bubble">{entry.question}</div>
      <button className="review-cta" onClick={onEscalate}>
        <WarningCircle size={19} weight="light" />
        <span>{answer.escalationRequired ? "Review request sent" : "Want Shona to review this personally? Usually within 4 hours."}</span>
      </button>
      <div className="answer-copy">
        {answer.answer.split("\n").map((line, index) => (line.trim() ? <p key={index}>{line}</p> : null))}
      </div>
      <div className="answer-trust-bar">
        <ShieldCheck size={18} weight="light" />
        <span>Built from the Beyond Freedom strategy library. Bring fact-specific decisions to the team before implementation.</span>
      </div>
      <div className="impact-badge">
        <TrendUp size={18} weight="light" />
        <span>{impactCopy(answer)}</span>
      </div>
      <section>
        <h3>Sources</h3>
        <div className="citation-list">
          {answer.citations.map((citation) => (
            <article key={`${citation.sourceId}-${citation.wikiPageId}-${citation.quoteSpan}`} className="citation-card">
              <span>{citation.sourceType}</span>
              <strong>{citation.sourceTitle}</strong>
              <p>{cleanCitationExcerpt(citation.quoteSpan)}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h3>Next steps</h3>
        <ul className="check-list">
          {answer.nextSteps.map((step) => (
            <li key={step}><CheckCircle size={16} weight="light" />{step}</li>
          ))}
        </ul>
      </section>
      {answer.recommendedTrainings.length ? (
        <section>
          <h3>Recommended Learn pages</h3>
          <div className="training-row">
            {answer.recommendedTrainings.map((training) => (
              <RecommendationCard key={training.url} training={training} navigate={navigate} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="follow-up-row">
        {followUps.map((prompt) => (
          <button key={prompt} onClick={() => onFollowUp(prompt)}>{prompt}</button>
        ))}
      </section>
      <div className="answer-actions">
        <button onClick={() => onFeedback("up")} aria-label="This answer helped"><ThumbsUp size={18} weight="light" /> Helpful</button>
        <button onClick={() => onFeedback("down")} aria-label="This answer needs review"><ThumbsDown size={18} weight="light" /> Needs work</button>
        <button onClick={() => window.print()}><FileText size={18} weight="light" /> Print</button>
      </div>
    </article>
  );
}

function RecommendationCard({ training, navigate }: { training: TrainingRecommendation; navigate: (path: string) => void }) {
  const learnUrl = training.url.replace("/trainings", "/learn");
  return (
    <article className="recommendation-card">
      <button onClick={() => navigate(learnUrl)}>
        <BookOpenText size={18} weight="light" />
        <span>{training.title}</span>
      </button>
      {training.assetTitle && training.assetUrl ? (
        <a href={training.assetUrl} target="_blank" rel="noreferrer">
          <DownloadSimple size={17} weight="light" />
          {training.assetTitle}
        </a>
      ) : null}
    </article>
  );
}

function TrainingVault({ navigate }: { navigate: (path: string) => void }) {
  const [items, setItems] = useState<WikiPage[]>([]);
  const [recommended, setRecommended] = useState<PlanItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const recentSearches = readStorage<string[]>("learn-recent-searches", []);
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => categoryFor(item.strategyKey))))], [items]);

  useEffect(() => {
    api<{ trainings: WikiPage[]; recommended: PlanItem[] }>("/api/trainings").then((data) => {
      setItems(data.trainings);
      setRecommended(data.recommended || []);
    });
  }, []);

  useEffect(() => {
    if (query.trim().length > 2) {
      const next = [query.trim(), ...recentSearches.filter((item) => item !== query.trim())].slice(0, 4);
      writeStorage("learn-recent-searches", next);
    }
  }, [query, recentSearches]);

  const filtered = items.filter((item) => {
    const matchesQuery = `${item.title} ${item.summary} ${item.strategyKey}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "All" || categoryFor(item.strategyKey) === category;
    return matchesQuery && matchesCategory;
  });
  const continueReading = items.find((item) => progressFor(item.slug) > 0 && progressFor(item.slug) < 100);

  return (
    <section className="content-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">Learn</p>
        <h1>Beyond Freedom strategy library.</h1>
        <p>Search official strategy lessons, implementation steps, checklists, and client action plans.</p>
      </div>
      {continueReading ? (
        <button className="continue-card motion-in" onClick={() => navigate(`/learn/${continueReading.slug}`)}>
          <BookOpenText size={24} weight="light" />
          <div>
            <span className="mini-label">Continue reading</span>
            <h2>{continueReading.title}</h2>
          </div>
          <strong>{progressFor(continueReading.slug)}%</strong>
        </button>
      ) : null}
      {recommended.length ? (
        <section className="recommended-band motion-in">
          <div>
            <span className="mini-label">Recommended for you</span>
            <h2>Start with the pages and kits tied to your profile.</h2>
          </div>
          <div className="recommended-grid">
            {recommended.slice(0, 4).map((item) => (
              <article key={`${item.slug || item.title}-${item.assetUrl || ""}`} className="recommended-card">
                <button onClick={() => item.slug && navigate(`/learn/${item.slug}`)}>
                  <BookOpenText size={19} weight="light" />
                  <span>{item.title}</span>
                </button>
                <p>{item.reason}</p>
                {item.assetTitle && item.assetUrl ? (
                  <a href={item.assetUrl} target="_blank" rel="noreferrer">
                    <DownloadSimple size={17} weight="light" />
                    {item.assetTitle}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="vault-toolbar motion-in">
        <div className="search-box">
          <MagnifyingGlass size={18} weight="light" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search strategy, training, or question" />
        </div>
        <div className="vault-count">
          <strong>{filtered.length}</strong>
          <span>published pages</span>
        </div>
      </div>
      <div className="filter-row motion-in" aria-label="Learn categories">
        {categories.map((item) => (
          <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {recentSearches.length ? (
        <div className="recent-searches motion-in">
          <span className="mini-label">Recent searches</span>
          {recentSearches.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}
        </div>
      ) : null}
      <div className="learn-grid motion-in">
        {filtered.map((item) => {
          const progress = progressFor(item.slug);
          return (
            <button key={item.id} className="learn-card stack-card" onClick={() => navigate(`/learn/${item.slug}`)}>
              <div className="learn-card-top">
                <span>{categoryFor(item.strategyKey)}</span>
                {isNewPage(item) ? <strong>New</strong> : null}
              </div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <div className="progress-track" aria-label={`Reading progress ${progress}%`}>
                <i style={{ width: `${progress}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TrainingDetail({ slug, navigate, announce }: { slug: string; navigate: (path: string) => void; announce: (message: string) => void }) {
  const [page, setPage] = useState<WikiPage | null>(null);
  const [assets, setAssets] = useState<DownloadAsset[]>([]);
  const [allPages, setAllPages] = useState<WikiPage[]>([]);
  const storageKey = `learn-progress:${slug}`;

  useEffect(() => {
    api<{ page: WikiPage; assets: DownloadAsset[] }>(`/api/trainings/${slug}`).then((data) => {
      setPage(data.page);
      setAssets(data.assets || []);
    });
    api<{ trainings: WikiPage[]; recommended: PlanItem[] }>("/api/trainings").then((data) => setAllPages(data.trainings));
  }, [slug]);

  useEffect(() => {
    const saved = readStorage<number>(`${storageKey}:scroll`, 0);
    if (saved > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "instant" }));
    }
    let frame = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const percent = Math.min(100, Math.round((window.scrollY / max) * 100));
        writeStorage(storageKey, percent);
        writeStorage(`${storageKey}:scroll`, Math.round(window.scrollY));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [storageKey]);

  if (!page) {
    return <LoadingScreen />;
  }

  const related = allPages.filter((item) => item.slug !== page.slug && categoryFor(item.strategyKey) === categoryFor(page.strategyKey)).slice(0, 3);

  return (
    <article className="reader-page motion-in">
      <header className="reader-topbar">
        <button onClick={() => navigate("/learn")}><CaretLeft size={18} weight="light" /> Learn</button>
        <button onClick={() => {
          writeStorage(storageKey, 100);
          announce("Marked complete.");
        }}>Mark complete</button>
      </header>
      <section className="reader-header">
        <p className="eyebrow">{categoryFor(page.strategyKey)}</p>
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
      </section>
      <DownloadsSection assets={assets} />
      <div className="reader-body" dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(page.markdown || page.summary) }} />
      {related.length ? (
        <section className="related-pages">
          <h2>Related pages</h2>
          <div>
            {related.map((item) => (
              <button key={item.id} onClick={() => navigate(`/learn/${item.slug}`)}>{item.title}</button>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function DownloadsSection({ assets }: { assets: DownloadAsset[] }) {
  if (!assets.length) {
    return null;
  }
  return (
    <section className="downloads-panel motion-in" aria-label="Downloads">
      <div>
        <span className="mini-label">Downloads</span>
        <h2>Use these while you work through the lesson.</h2>
      </div>
      <div className="download-grid">
        {assets.map((asset) => (
          <a key={asset.id} href={asset.downloadUrl} target="_blank" rel="noreferrer">
            <DownloadSimple size={20} weight="light" />
            <span>
              <strong>{asset.title}</strong>
              <small>{asset.description}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function PlanView({ announce }: { announce: (message: string) => void }) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [saving, setSaving] = useState("");

  useEffect(() => {
    api<{ items: PlanItem[] }>("/api/plan").then((data) => setItems(data.items));
  }, []);

  const toggle = async (item: PlanItem) => {
    const next = !item.done;
    setItems((current) => current.map((value) => value.title === item.title ? { ...value, done: next } : value));
    setSaving(item.title);
    try {
      await api("/api/plan/items", {
        method: "PATCH",
        body: JSON.stringify({ title: item.title, strategyKey: item.strategyKey, done: next })
      });
      announce(next ? "Plan item checked off." : "Plan item reopened.");
    } finally {
      setSaving("");
    }
  };

  const complete = items.filter((item) => item.done).length;
  const percent = items.length ? Math.round((complete / items.length) * 100) : 0;

  return (
    <section className="content-page plan-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">My Plan</p>
        <h1>A focused checklist from your profile.</h1>
        <p>Check off what you have gathered. When a task affects payroll, filings, or entity setup, bring it to Shona/Jay before acting.</p>
      </div>
      <div className="plan-summary motion-in">
        <Gauge size={28} weight="light" />
        <div>
          <span className="mini-label">Progress</span>
          <h2>{complete} of {items.length} complete</h2>
        </div>
        <strong>{percent}%</strong>
      </div>
      <div className="timeline-list motion-in">
        {items.map((item) => (
          <article className={`plan-item stack-card ${item.done ? "done" : ""}`} key={item.title}>
            <button className="check-button" onClick={() => toggle(item)} aria-pressed={item.done} disabled={saving === item.title}>
              {item.done ? <CheckCircle size={24} weight="fill" /> : <span />}
            </button>
            <div>
              <h2>{item.title}</h2>
              <p>{item.reason}</p>
              <span>{readable(item.strategyKey)}</span>
              <small>{planCommitment(item)}</small>
              <div className="plan-links">
                {item.slug ? <a href={`/learn/${item.slug}`}>Open lesson</a> : null}
                {item.assetTitle && item.assetUrl ? <a href={item.assetUrl} target="_blank" rel="noreferrer">{item.assetTitle}</a> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {items.length > 0 && complete === items.length ? (
        <div className="completion-card motion-in">
          <CheckCircle size={24} weight="fill" />
          <span>Your starter plan is complete. Bring final implementation questions to Shona/Jay.</span>
        </div>
      ) : null}
    </section>
  );
}

function MoreView({ me, navigate, logout }: { me: AppMe; navigate: (path: string) => void; logout: () => void }) {
  const client = me.client;
  const saved = readStorage<ConversationEntry[]>(`ask-history:${client?.id || "anonymous"}`, []);
  return (
    <section className="content-page more-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">More</p>
        <h1>Your portal, settings, and history.</h1>
      </div>
      <div className="advisor-card motion-in">
        <ShieldCheck size={30} weight="light" />
        <div>
          <span className="mini-label">Advisor team</span>
          <h2>Shona Bell & Jay Moore</h2>
          <p>Next review window: weekly client call or personal escalation.</p>
        </div>
      </div>
      <div className="profile-grid motion-in">
        <ProfileItem label="Email" value={client?.email || ""} />
        <ProfileItem label="Tier" value={client?.tier || ""} />
        <ProfileItem label="Entity" value={friendlyEntity(client?.entityType)} />
        <ProfileItem label="Lifecycle" value={client?.lifecycleStage || ""} />
        <ProfileItem label="Tags" value={(client?.tags || []).map(readable).join(", ")} />
        <ProfileItem label="Security" value="Encrypted portal session with source-grounded answers" />
      </div>
      <div className="quick-actions motion-in">
        <button onClick={() => navigate("/history")}><ClockCounterClockwise size={20} weight="light" /> History <span>{saved.length}</span></button>
        <button onClick={() => navigate("/learn")}><BookOpenText size={20} weight="light" /> Learn library</button>
        <button onClick={() => navigate("/my-plan")}><ListChecks size={20} weight="light" /> My Plan</button>
        <button onClick={logout}><SignOut size={20} weight="light" /> Sign out</button>
      </div>
    </section>
  );
}

function HistoryView({ me, navigate }: { me: AppMe; navigate: (path: string) => void }) {
  const history = readStorage<ConversationEntry[]>(`ask-history:${me.client?.id || "anonymous"}`, []);
  return (
    <section className="content-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">History</p>
        <h1>Recent questions on this device.</h1>
      </div>
      <div className="timeline-list motion-in">
        {history.map((entry) => (
          <article className="stack-card" key={entry.id}>
            <ClockCounterClockwise size={22} weight="light" />
            <div>
              <h2>{entry.question}</h2>
              <p>{readableState(entry.answer.state)}</p>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          </article>
        ))}
        {!history.length ? (
          <article className="empty-list stack-card">
            <h2>No history yet</h2>
            <p>Ask a question and it will appear here.</p>
            <button className="primary-button" onClick={() => navigate("/ask")}><span>Ask a question</span><span className="button-orb"><ArrowRight size={17} /></span></button>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function AdminRouter({ path }: { path: string; navigate: (path: string) => void }) {
  if (path === "/admin/review" || path === "/admin") {
    return <AdminReviewDashboard />;
  }
  if (path === "/admin/wiki") {
    return <AdminWiki />;
  }
  if (path === "/admin/questions") {
    return <AdminQuestions />;
  }
  if (path === "/admin/health") {
    return <AdminHealth />;
  }
  if (path === "/admin/settings") {
    return <AdminSettings />;
  }
  return <AdminSources />;
}

function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const refresh = () => api<DashboardData>("/api/admin/dashboard").then(setData);
  useEffect(() => {
    refresh();
  }, []);
  return { data, refresh };
}

function AdminSources() {
  const { data, refresh } = useDashboard();
  const [form, setForm] = useState({
    title: "New Strategy Training",
    sourceType: "training",
    strategyKey: "estimated-taxes",
    content: "Paste approved training, transcript, email, or strategy documentation here.",
    visibilityTier: "mid",
    effectiveYear: "2026"
  });
  const [message, setMessage] = useState("");

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const created = await api<{ ok: boolean; id: string }>("/api/admin/sources", {
      method: "POST",
      body: JSON.stringify({ ...form, visibility: "client", audience: "clients", reviewOwner: "Admin" })
    });
    const ingested = await api<{ ok: boolean; wikiId: string }>(`/api/admin/sources/${created.id}/ingest`, {
      method: "POST",
      body: "{}"
    });
    setMessage(`Source processed into draft wiki page ${ingested.wikiId}.`);
    await refresh();
  };

  return (
    <section className="admin-page">
      <AdminHeader title="Knowledge Ops" subtitle="Upload approved material, compile wiki drafts, and publish only after review." />
      <div className="admin-grid">
        <form className="admin-form motion-in" onSubmit={upload}>
          <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Source type<select value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
            <option value="training">Training</option>
            <option value="transcript">Transcript</option>
            <option value="email">Email</option>
            <option value="strategy_doc">Strategy doc</option>
            <option value="faq">FAQ</option>
            <option value="pdf_text">PDF text</option>
          </select></label>
          <label>Strategy key<input value={form.strategyKey} onChange={(event) => setForm({ ...form, strategyKey: event.target.value })} /></label>
          <label>Effective year<input value={form.effectiveYear} onChange={(event) => setForm({ ...form, effectiveYear: event.target.value })} /></label>
          <label>Content<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
          <button className="primary-button" type="submit"><span>Compile draft</span><span className="button-orb"><UploadSimple size={17} /></span></button>
          {message ? <p className="notice">{message}</p> : null}
        </form>
        <AdminMetricPanel data={data} />
      </div>
      <AdminTable title="Recent sources" rows={data?.sources || []} columns={["title", "sourceType", "status", "strategyKey", "updatedAt"]} />
    </section>
  );
}

function AdminReviewDashboard() {
  const { data, refresh } = useDashboard();
  const runChecks = async () => {
    await api("/api/admin/health/run", { method: "POST", body: "{}" });
    await refresh();
  };
  return (
    <section className="admin-page">
      <AdminHeader title="Review Dashboard" subtitle="Triage client confusion, weak answers, content gaps, and pages that need an admin pass." />
      <div className="admin-grid review-overview">
        <AdminMetricPanel data={data} />
        <div className="admin-form motion-in">
          <h2>Review actions</h2>
          <p>Run checks after publishing lessons or importing assets so missing downloads, stale pages, and answer gaps surface here.</p>
          <button className="primary-button" onClick={runChecks}><span>Run review checks</span><span className="button-orb"><Heartbeat size={17} /></span></button>
        </div>
      </div>
      {data ? (
        <div className="review-dashboard motion-in">
          <ReviewGroup title="Unanswered questions" items={data.review.unansweredQuestions} empty="No unanswered questions are open." />
          <ReviewGroup title="Low-confidence answers" items={data.review.lowConfidenceAnswers} empty="No low-confidence answers are open." />
          <ReviewGroup title="Repeated confusion" items={data.review.repeatedConfusion} empty="No repeated confusion clusters yet." />
          <ReviewGroup title="Content gaps" items={data.review.contentGaps} empty="No open content gaps." />
          <ReviewGroup title="Pages needing review" items={data.review.pagesNeedingReview} empty="No pages need review right now." />
        </div>
      ) : null}
    </section>
  );
}

function ReviewGroup({ title, items, empty }: { title: string; items: DashboardData["review"]["unansweredQuestions"]; empty: string }) {
  return (
    <section className="review-group stack-card">
      <div className="review-group-heading">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        <div className="review-items">
          {items.slice(0, 8).map((item) => (
            <article key={item.id} className={`review-item severity-${item.severity}`}>
              <span>{item.category}{item.count ? ` · ${item.count}` : ""}</span>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
              {item.targetUrl ? <a href={item.targetUrl}>Open</a> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-review">{empty}</p>
      )}
    </section>
  );
}

function AdminWiki() {
  const { data, refresh } = useDashboard();
  const publish = async (id: string) => {
    await api(`/api/admin/wiki/${id}/publish`, { method: "POST", body: "{}" });
    await refresh();
  };
  return (
    <section className="admin-page">
      <AdminHeader title="Wiki Review" subtitle="Drafts are not client-visible until published by an admin." />
      <div className="wiki-review-list motion-in">
        {(data?.wikiPages || []).map((page) => (
          <article key={page.id} className="review-card stack-card">
            <span className={`status-chip ${page.status === "published" ? "clear" : "review"}`}>{page.status}</span>
            <h2>{page.title}</h2>
            <p>{page.summary}</p>
            <button className="secondary-button" onClick={() => publish(page.id)}>
              <span>{page.status === "published" ? "Refresh publication" : "Publish"}</span>
              <span className="button-orb"><ArrowRight size={17} /></span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminQuestions() {
  const { data } = useDashboard();
  return (
    <section className="admin-page">
      <AdminHeader title="Questions And Escalations" subtitle="Client-specific or unsupported questions are routed here for review." />
      <div className="timeline-list motion-in">
        {(data?.escalations || []).map((item) => (
          <article className="stack-card" key={item.id}>
            <PaperPlaneTilt size={22} weight="light" />
            <div>
              <h2>{item.reason}</h2>
              <p>{item.redactedSummary}</p>
              <span>{item.status} · {new Date(item.createdAt).toLocaleString()}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminHealth() {
  const { data, refresh } = useDashboard();
  const runChecks = async () => {
    await api("/api/admin/health/run", { method: "POST", body: "{}" });
    await refresh();
  };
  return (
    <section className="admin-page">
      <AdminHeader title="Knowledge Health" subtitle="Find stale drafts, source gaps, unanswered questions, and publication drift." />
      <button className="primary-button motion-in" onClick={runChecks}><span>Run health checks</span><span className="button-orb"><Heartbeat size={17} /></span></button>
      <div className="timeline-list motion-in">
        {(data?.healthFindings || []).map((item) => (
          <article className="stack-card" key={item.id}>
            <WarningCircle size={22} weight="light" />
            <div>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
              <span>{item.severity} · {item.category}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminSettings() {
  return (
    <section className="admin-page">
      <AdminHeader title="Settings" subtitle="Production integrations are controlled by Cloudflare secrets and environment bindings." />
      <div className="profile-grid motion-in">
        <ProfileItem label="CRM" value="GoHighLevel allowlist: contact id, email, access tier, selected tags, lifecycle status" />
        <ProfileItem label="AI Gateway" value="Payload logging disabled for sensitive routes; personalized answers skip cache" />
        <ProfileItem label="Admin access" value="Shared master password with app-level role checks" />
        <ProfileItem label="Domain" value="ask.beyondfreedomfinancial.com" />
      </div>
    </section>
  );
}

function AdminHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-intro motion-in">
      <p className="eyebrow">Admin console</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function AdminMetricPanel({ data }: { data: DashboardData | null }) {
  const metrics = data?.metrics;
  return (
    <div className="metric-panel motion-in">
      <Metric label="Published pages" value={metrics?.publishedPages ?? 0} />
      <Metric label="Draft pages" value={metrics?.draftPages ?? 0} />
      <Metric label="Open escalations" value={metrics?.openEscalations ?? 0} />
      <Metric label="Health findings" value={metrics?.healthFindings ?? 0} />
      <Metric label="Conversations" value={metrics?.conversations ?? 0} />
      <Metric label="Unanswered" value={metrics?.unansweredQuestions ?? 0} />
      <Metric label="Low confidence" value={metrics?.lowConfidenceAnswers ?? 0} />
      <Metric label="Pages to review" value={metrics?.pagesNeedingReview ?? 0} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AdminTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <section className="table-shell motion-in">
      <h2>{title}</h2>
      <div className="data-table" role="table" aria-label={title}>
        <div className="data-row head" role="row">{columns.map((column) => <span role="columnheader" key={column}>{column}</span>)}</div>
        {rows.map((row) => (
          <div className="data-row" role="row" key={row.id}>{columns.map((column) => <span role="cell" key={column}>{String(row[column] ?? "")}</span>)}</div>
        ))}
      </div>
    </section>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="profile-item stack-card">
      <span>{label}</span>
      <strong>{value || "Not set"}</strong>
    </article>
  );
}

function readableState(state: string): string {
  const labels: Record<string, string> = {
    answered_with_citations: "Answer from approved sources",
    needs_more_context: "Shona may need more details",
    cpa_review_recommended: "Recommended for expert review",
    cannot_answer_from_approved_sources: "Shona will find the answer",
    escalated_to_team: "Sent to Shona's team"
  };
  return labels[state] || readable(state);
}

function suggestedPrompts(me: AppMe): string[] {
  const tags = new Set(me.client?.tags || []);
  const prompts = [
    "What should I do before estimated taxes are due?",
    "Which Learn pages should I review before my next strategy call?",
    "What documents should I gather before asking Shona to review this?"
  ];
  if (tags.has("hire-kids") || me.client?.hasChildren) {
    prompts.unshift("Should I hire my kids, and what facts should I gather first?");
  }
  if (tags.has("augusta-rule")) {
    prompts.unshift("How do I document an Augusta Rule rental?");
  }
  return prompts.slice(0, 5);
}

function sanitizeMarkdown(markdown: string): string {
  return DOMPurify.sanitize(String(marked.parse(markdown)));
}

function titleForPath(path: string): string {
  if (path.startsWith("/admin")) {
    return "Admin | Ask Shona/Jay";
  }
  if (path.startsWith("/learn")) {
    return "Learn | Ask Shona/Jay";
  }
  if (path.startsWith("/my-plan")) {
    return "My Plan | Ask Shona/Jay";
  }
  if (path.startsWith("/more")) {
    return "More | Ask Shona/Jay";
  }
  return "Ask | Ask Shona/Jay";
}

function isActive(path: string, href: string): boolean {
  if (href === "/ask") {
    return path === "/" || path === "/ask";
  }
  if (href === "/learn") {
    return path.startsWith("/learn") || path.startsWith("/trainings");
  }
  if (href === "/my-plan") {
    return path === "/my-plan" || path === "/plan";
  }
  if (href === "/more") {
    return path === "/more" || path === "/account" || path === "/history";
  }
  return path === href;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function readable(value?: string): string {
  return (value || "not set").replace(/[-_]/g, " ");
}

function friendlyEntity(value?: string): string {
  const normalized = readable(value);
  return normalized === "unknown" ? "Entity details pending" : normalized;
}

function readinessScore(me: AppMe, history: ConversationEntry[]): number {
  let score = 52;
  if (me.client?.entityType && me.client.entityType !== "unknown") score += 12;
  if (me.client?.tags?.length) score += Math.min(18, me.client.tags.length * 6);
  if (me.client?.hasChildren) score += 6;
  if (history.length) score += Math.min(12, history.length * 3);
  return Math.min(96, score);
}

function nextDeadline(): { label: string; days: number } {
  const now = new Date();
  const year = now.getFullYear();
  const dates = [
    new Date(year, 3, 15),
    new Date(year, 5, 15),
    new Date(year, 8, 15),
    new Date(year + 1, 0, 15)
  ];
  const target = dates.find((date) => date.getTime() > now.getTime()) || dates[dates.length - 1];
  return {
    label: target.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
    days: Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
  };
}

function impactCopy(answer: ChatAnswer): string {
  if (answer.state === "answered_with_citations") {
    return "Businesses like yours often lose savings when documentation waits until year-end.";
  }
  if (answer.escalationRequired) {
    return "A quick review now can prevent a wrong filing, payroll, or entity decision later.";
  }
  return "Use this as a fact-gathering step before Shona/Jay make a recommendation.";
}

function cleanCitationExcerpt(input: string): string {
  return input
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function followUpPrompts(question: string, answer: ChatAnswer): string[] {
  const lower = `${question} ${answer.answer}`.toLowerCase();
  if (lower.includes("kid") || lower.includes("payroll")) {
    return ["What documents should I gather first?", "When should Shona/Jay review this?", "What common mistakes should I avoid?"];
  }
  if (lower.includes("augusta") || lower.includes("rental")) {
    return ["What should be in the agenda?", "What proof of rental value should I keep?", "When does this need expert review?"];
  }
  if (lower.includes("estimated")) {
    return ["What numbers should I bring?", "What changed since last quarter?", "Which Learn page explains this?"];
  }
  return ["What facts would make this answer stronger?", "Which Learn page should I open?", "Should Shona/Jay review this?"];
}

function categoryFor(strategyKey: string): string {
  if (strategyKey.includes("kid") || strategyKey.includes("classification")) return "People";
  if (strategyKey.includes("estimated") || strategyKey.includes("qbi")) return "Tax Readiness";
  if (strategyKey.includes("home") || strategyKey.includes("augusta")) return "Home & Office";
  if (strategyKey.includes("retirement") || strategyKey.includes("health")) return "Benefits";
  if (strategyKey.includes("vehicle") || strategyKey.includes("travel") || strategyKey.includes("179") || strategyKey.includes("depreciation")) return "Documentation";
  return "Strategy";
}

function progressFor(slug: string): number {
  return readStorage<number>(`learn-progress:${slug}`, 0);
}

function isNewPage(page: WikiPage): boolean {
  const stamp = page.publishedAt || page.updatedAt;
  if (!stamp) {
    return false;
  }
  const age = Date.now() - new Date(stamp).getTime();
  return age < 14 * 86_400_000;
}

function planCommitment(item: PlanItem): string {
  if (item.done) {
    return "Completed. Keep supporting documents handy for review.";
  }
  if (item.strategyKey.includes("estimated")) {
    return "When you are ready, gather year-to-date income, withholding, and profit estimates.";
  }
  if (item.strategyKey.includes("kids")) {
    return "When you are ready, gather role, hours, pay rate, and payroll details.";
  }
  if (item.strategyKey.includes("augusta")) {
    return "When you are ready, gather agenda, attendees, notes, and comparable rates.";
  }
  return "When you are ready, gather facts and bring client-specific decisions to Shona/Jay.";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
