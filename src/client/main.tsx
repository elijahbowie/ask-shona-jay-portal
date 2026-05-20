import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle,
  Database,
  FileText,
  Heartbeat,
  House,
  LockKey,
  MagnifyingGlass,
  PaperPlaneTilt,
  ShieldCheck,
  SignOut,
  Sparkle,
  UploadSimple,
  WarningCircle
} from "@phosphor-icons/react";
import { marked } from "marked";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { AppMe, ChatAnswer, DashboardData, WikiPage } from "../shared/types";
import "./styles.css";

gsap.registerPlugin(ScrollTrigger);

type ApiError = { error: string };

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
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".motion-in");
      gsap.fromTo(targets, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.92, stagger: 0.055, ease: "expo.out" });

      gsap.utils.toArray<HTMLElement>(".stack-card").forEach((card, index) => {
        gsap.fromTo(
          card,
          { y: 46, opacity: 0, scale: 0.985 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.9,
            delay: index * 0.025,
            ease: "expo.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              end: "bottom 20%",
              toggleActions: "play none none reverse"
            }
          }
        );
      });

      gsap.utils.toArray<HTMLElement>(".media-orbit").forEach((media) => {
        gsap.fromTo(
          media,
          { scale: 0.92, opacity: 0.72 },
          {
            scale: 1,
            opacity: 1,
            ease: "power1.out",
            scrollTrigger: {
              trigger: media,
              start: "top 92%",
              end: "bottom 18%",
              scrub: true
            }
          }
        );
      });
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

  return (
    <main className="app-shell">
      <TopNav me={me} path={path} navigate={navigate} logout={logout} />
      {me.role === "admin" ? (
        <AdminRouter path={path} navigate={navigate} />
      ) : (
        <ClientRouter me={me} path={path} navigate={navigate} />
      )}
    </main>
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
      setMessage(result.devCode ? `Development code: ${result.devCode}` : "Check your email for the login code.");
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
        body: JSON.stringify({ email, code })
      });
      onLogin(result);
      window.history.replaceState({}, "", result.role === "admin" ? "/admin/sources" : "/ask");
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
      window.history.replaceState({}, "", "/admin/sources");
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
        <h1>Ask <span className="headline-image media-orbit" aria-hidden="true" /> Shona/Jay from approved strategy materials.</h1>
        <p>
          A private client knowledge portal for tax strategy education, cited training guidance,
          and quick escalation when the team needs to review your facts.
        </p>
        <div className="portal-marquee" aria-label="Portal capabilities">
          <div>
            <span>Source-backed answers</span>
            <span>Training vault</span>
            <span>Team escalation</span>
            <span>Client checklists</span>
          </div>
        </div>
      </section>
      <section className="login-card-shell motion-in">
        <div className="login-card">
          <div className="card-heading">
            <LockKey size={26} weight="light" />
            <div>
              <h2>{isAdminPreview ? "Admin preview" : "Secure portal login"}</h2>
              <p>{isAdminPreview ? "Use the shared preview password to review the knowledge operations console." : "Use your client email to receive a short-lived access code."}</p>
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
          ) : (
            <>
              <form onSubmit={requestCode} className="stack">
                <label>
                  Email
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="text" inputMode="email" autoComplete="email" />
                </label>
                <button className="primary-button" type="submit" disabled={busy}>
                  <span>{busy ? "Sending" : "Send code"}</span>
                  <span className="button-orb"><ArrowRight size={17} /></span>
                </button>
              </form>
              <form onSubmit={verify} className="stack">
                <label>
                  Code
                  <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" />
                </label>
                <button className="secondary-button" type="submit" disabled={busy || code.length < 4}>
                  <span>Enter portal</span>
                  <span className="button-orb"><ArrowRight size={17} /></span>
                </button>
              </form>
            </>
          )}
          {message ? <p className="notice">{message}</p> : null}
          {devCode ? <p className="microcopy">Local development shows the code so the full login workflow is testable.</p> : null}
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
    ["/trainings", "Trainings", <BookOpenText size={17} weight="light" />],
    ["/plan", "Plan", <CheckCircle size={17} weight="light" />],
    ["/account", "Account", <House size={17} weight="light" />]
  ] as const;
  const adminItems = [
    ["/admin/sources", "Sources", <UploadSimple size={17} weight="light" />],
    ["/admin/wiki", "Wiki", <FileText size={17} weight="light" />],
    ["/admin/questions", "Questions", <PaperPlaneTilt size={17} weight="light" />],
    ["/admin/health", "Health", <Heartbeat size={17} weight="light" />],
    ["/admin/settings", "Settings", <Database size={17} weight="light" />]
  ] as const;
  const items = me.role === "admin" ? adminItems : clientItems;

  return (
    <nav className="top-nav motion-in">
      <button className="wordmark" onClick={() => navigate(me.role === "admin" ? "/admin/sources" : "/ask")}>
        <span className="wordmark-mark" aria-hidden="true">BF</span>
        <span>Ask Shona/Jay</span>
      </button>
      <div className="nav-links">
        {items.map(([href, label, icon]) => (
          <button key={href} className={path === href ? "active" : ""} onClick={() => navigate(href)}>
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

function ClientRouter({ me, path, navigate }: { me: AppMe; path: string; navigate: (path: string) => void }) {
  if (path.startsWith("/trainings/")) {
    return <TrainingDetail slug={path.split("/").pop() || ""} />;
  }
  if (path === "/trainings") {
    return <TrainingVault navigate={navigate} />;
  }
  if (path === "/plan") {
    return <PlanView />;
  }
  if (path === "/account") {
    return <AccountView me={me} />;
  }
  return <AskView me={me} />;
}

function AskView({ me }: { me: AppMe }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prompts = useMemo(() => suggestedPrompts(me), [me]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!question.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      const result = await api<ChatAnswer>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ question })
      });
      setAnswer(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer right now.");
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    if (!answer) {
      return;
    }
    await api("/api/escalations", {
      method: "POST",
      body: JSON.stringify({
        conversationId: answer.conversationId,
        question,
        reason: answer.escalationReason || "Client requested team review."
      })
    });
    setAnswer({ ...answer, escalationRequired: true, state: "escalated_to_team", escalationReason: "Sent to the team for review." });
  };

  return (
    <section className="page-grid ask-layout">
      <div className="page-intro motion-in">
        <p className="eyebrow">Client knowledge portal</p>
        <h1>Ask from approved Beyond Freedom guidance.</h1>
        <p>
          Answers are grounded in published trainings and wiki pages. When a question depends on your exact facts,
          the portal routes it to the team.
        </p>
        <div className="context-strip">
          <span>{me.client?.name || me.client?.email || "Client"}</span>
          <span>{me.client?.tier || "active"} tier</span>
          <span>{(me.client?.tags || []).slice(0, 2).join(" / ") || "profile-based guidance"}</span>
        </div>
      </div>
      <div className="ask-panel-shell motion-in">
        <div className="ask-panel">
          <form className="ask-form" onSubmit={submit}>
            <label htmlFor="question">Your question</label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: I have two kids and an S-corp. What should I understand before using the hire-your-kids strategy?"
            />
            <button className="primary-button ask-submit" type="submit" disabled={busy}>
              <span>{busy ? "Searching approved sources" : "Ask Shona/Jay"}</span>
              <span className="button-orb"><PaperPlaneTilt size={17} /></span>
            </button>
          </form>
          <div className="prompt-grid">
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => setQuestion(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
      <AnswerPanel answer={answer} busy={busy} onEscalate={escalate} />
    </section>
  );
}

function AnswerPanel({ answer, busy, onEscalate }: { answer: ChatAnswer | null; busy: boolean; onEscalate: () => void }) {
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
  if (!answer) {
    return (
      <div className="answer-panel-shell motion-in">
        <div className="answer-panel empty-answer stack-card">
          <MagnifyingGlass size={32} weight="light" />
          <h2>Source-backed answers appear here.</h2>
          <p>Ask a question and the portal will show citations, trainings, next steps, and review status.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="answer-panel-shell motion-in">
      <div className="answer-panel stack-card">
        <div className={`status-chip ${answer.escalationRequired ? "review" : "clear"}`}>
          {answer.escalationRequired ? <WarningCircle size={16} /> : <CheckCircle size={16} />}
          {readableState(answer.state)}
        </div>
        <div className="answer-copy">
          {answer.answer.split("\n").map((line, index) => (line.trim() ? <p key={index}>{line}</p> : null))}
        </div>
        <section>
          <h3>Citations</h3>
          <div className="citation-list">
            {answer.citations.map((citation) => (
              <article key={`${citation.sourceId}-${citation.wikiPageId}`} className="citation-card">
                <span>{citation.sourceType}</span>
                <strong>{citation.sourceTitle}</strong>
                <p>{citation.quoteSpan}</p>
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
            <h3>Recommended trainings</h3>
            <div className="training-row">
              {answer.recommendedTrainings.map((training) => (
                <a key={training.url} href={training.url}>
                  <BookOpenText size={18} weight="light" />
                  <span>{training.title}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
        <button className="secondary-button" onClick={onEscalate}>
          <span>{answer.escalationRequired ? "Escalation recorded" : "Ask the team to review"}</span>
          <span className="button-orb"><ArrowRight size={17} /></span>
        </button>
      </div>
    </div>
  );
}

function TrainingVault({ navigate }: { navigate: (path: string) => void }) {
  const [items, setItems] = useState<WikiPage[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<{ trainings: WikiPage[] }>("/api/trainings").then((data) => setItems(data.trainings));
  }, []);

  const filtered = items.filter((item) => `${item.title} ${item.summary} ${item.strategyKey}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="content-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">Training vault</p>
        <h1>Published guidance clients can trust.</h1>
        <p>Search the preview knowledge base by strategy, situation, or repeated client question.</p>
      </div>
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
      <div className="bento-grid motion-in">
        {filtered.map((item, index) => (
          <button key={item.id} className={`bento-card stack-card span-${index % 5}`} onClick={() => navigate(`/trainings/${item.slug}`)}>
            <span>{item.strategyKey.replace(/-/g, " ")}</span>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function TrainingDetail({ slug }: { slug: string }) {
  const [page, setPage] = useState<WikiPage | null>(null);
  useEffect(() => {
    api<{ page: WikiPage }>(`/api/trainings/${slug}`).then((data) => setPage(data.page));
  }, [slug]);
  if (!page) {
    return <LoadingScreen />;
  }
  return (
    <article className="reader-page motion-in">
      <header className="reader-header">
        <p className="eyebrow">{page.strategyKey.replace(/-/g, " ")}</p>
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
      </header>
      <div className="reader-body" dangerouslySetInnerHTML={{ __html: marked.parse(page.markdown || page.summary) }} />
    </article>
  );
}

function PlanView() {
  const [items, setItems] = useState<Array<{ title: string; done: boolean; reason: string; strategyKey: string }>>([]);
  useEffect(() => {
    api<{ items: Array<{ title: string; done: boolean; reason: string; strategyKey: string }> }>("/api/plan").then((data) => setItems(data.items));
  }, []);
  return (
    <section className="content-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">Recommended action plan</p>
        <h1>A simple checklist from your profile tags.</h1>
      </div>
      <div className="timeline-list motion-in">
        {items.map((item) => (
          <article className="stack-card" key={item.title}>
            <CheckCircle size={22} weight="light" />
            <div>
              <h2>{item.title}</h2>
              <p>{item.reason}</p>
              <span>{item.strategyKey.replace(/-/g, " ")}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AccountView({ me }: { me: AppMe }) {
  const client = me.client;
  return (
    <section className="content-page">
      <div className="page-intro motion-in">
        <p className="eyebrow">Account</p>
        <h1>{client?.name}</h1>
      </div>
      <div className="profile-grid motion-in">
        <ProfileItem label="Email" value={client?.email || ""} />
        <ProfileItem label="Tier" value={client?.tier || ""} />
        <ProfileItem label="Entity" value={client?.entityType || ""} />
        <ProfileItem label="Lifecycle" value={client?.lifecycleStage || ""} />
        <ProfileItem label="Tags" value={(client?.tags || []).join(", ")} />
        <ProfileItem label="Access" value={client?.accessStatus || ""} />
      </div>
    </section>
  );
}

function AdminRouter({ path }: { path: string; navigate: (path: string) => void }) {
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
      <div className="data-table">
        <div className="data-row head">{columns.map((column) => <span key={column}>{column}</span>)}</div>
        {rows.map((row) => (
          <div className="data-row" key={row.id}>{columns.map((column) => <span key={column}>{String(row[column] ?? "")}</span>)}</div>
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
  return state.replace(/_/g, " ");
}

function suggestedPrompts(me: AppMe): string[] {
  const tags = new Set(me.client?.tags || []);
  const prompts = [
    "What should I do before estimated taxes are due?",
    "Which trainings should I review before my next strategy call?"
  ];
  if (tags.has("hire-kids") || me.client?.hasChildren) {
    prompts.unshift("I have children and an S-corp. What should I understand before hiring my kids?");
  }
  if (tags.has("augusta-rule")) {
    prompts.unshift("What documentation do I need before using the Augusta Rule?");
  }
  return prompts.slice(0, 5);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
