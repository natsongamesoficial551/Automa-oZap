import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { CompanyMembership } from "./types";

type Page = "dashboard" | "inbox" | "ai" | "integrations" | "knowledge" | "clients" | "logs" | "settings";

const navItems: Array<{ id: Page; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inbox", label: "Inbox" },
  { id: "ai", label: "IA" },
  { id: "integrations", label: "Integracoes" },
  { id: "knowledge", label: "Base" },
  { id: "clients", label: "Clientes" },
  { id: "logs", label: "Logs" },
  { id: "settings", label: "Configuracoes" },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [companyNameInput, setCompanyNameInput] = useState("");
  const [companySlugInput, setCompanySlugInput] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const [page, setPage] = useState<Page>("dashboard");

  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationItems, setConversationItems] = useState<Array<{ id: string; phone: string; lastMessageAt: string | null; lastText: string }>>([]);
  const [activeConversationId, setActiveConversationId] = useState("");

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageTimeline, setMessageTimeline] = useState<Array<{ id: string; direction: string; body: string; status: string; createdAt: string }>>([]);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [assistantName, setAssistantName] = useState("Atendente IA");
  const [tone, setTone] = useState("consultivo e objetivo");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("Oi! Sou o assistente virtual da empresa. Como posso ajudar?");
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessHours, setBusinessHours] = useState("Seg-Sex 08h-18h");
  const [faqText, setFaqText] = useState("Formate como: pergunta|resposta");

  const [previewInput, setPreviewInput] = useState("Quero saber formas de pagamento e horario.");
  const [previewOutput, setPreviewOutput] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16 },
    );

    for (const element of elements) observer.observe(element);

    return () => observer.disconnect();
  }, [page, memberships.length, conversationItems.length, messageTimeline.length]);

  async function loadMemberships() {
    if (!supabase || !session?.user.id) {
      setMemberships([]);
      return;
    }

    setMembershipsLoading(true);
    const { data, error } = await supabase
      .from("company_members")
      .select("role, company:companies(id, name)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(`Falha ao carregar empresas: ${error.message}`);
      setMemberships([]);
      setMembershipsLoading(false);
      return;
    }

    const mapped = (data ?? [])
      .map((item) => {
        const company = (item as { company?: { id?: string; name?: string } }).company;
        const role = (item as { role?: CompanyMembership["role"] }).role;
        if (!company?.id || !company?.name || !role) return null;
        return { companyId: company.id, companyName: company.name, role } satisfies CompanyMembership;
      })
      .filter((item): item is CompanyMembership => item !== null);

    setMemberships(mapped);
    setMembershipsLoading(false);
  }

  useEffect(() => {
    loadMemberships();
  }, [session?.user.id]);

  useEffect(() => {
    if (!activeCompanyId && memberships.length > 0) setActiveCompanyId(memberships[0].companyId);
  }, [memberships, activeCompanyId]);

  useEffect(() => {
    async function loadConversations() {
      if (!supabase || !activeCompanyId) {
        setConversationItems([]);
        return;
      }
      setConversationsLoading(true);

      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, customer_phone, last_message_at")
        .eq("company_id", activeCompanyId)
        .order("last_message_at", { ascending: false })
        .limit(12);

      if (convError) {
        setMessage(`Falha ao carregar conversas: ${convError.message}`);
        setConversationsLoading(false);
        return;
      }

      const ids = (conversations ?? []).map((item) => item.id);
      if (ids.length === 0) {
        setConversationItems([]);
        setConversationsLoading(false);
        return;
      }

      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });

      if (msgError) {
        setMessage(`Falha ao carregar mensagens: ${msgError.message}`);
        setConversationsLoading(false);
        return;
      }

      const lastMessageByConv = new Map<string, string>();
      for (const msg of messages ?? []) {
        if (!lastMessageByConv.has(msg.conversation_id)) lastMessageByConv.set(msg.conversation_id, msg.body);
      }

      setConversationItems(
        (conversations ?? []).map((conv) => ({
          id: conv.id,
          phone: conv.customer_phone,
          lastMessageAt: conv.last_message_at,
          lastText: lastMessageByConv.get(conv.id) ?? "Sem mensagens",
        })),
      );

      if (!activeConversationId && conversations.length > 0) setActiveConversationId(conversations[0].id);
      setConversationsLoading(false);
    }
    loadConversations();
  }, [activeCompanyId]);

  useEffect(() => {
    async function loadMessages() {
      if (!supabase || !activeConversationId) {
        setMessageTimeline([]);
        return;
      }

      setMessagesLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("id, direction, body, status, created_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        setMessage(`Falha ao carregar timeline: ${error.message}`);
        setMessagesLoading(false);
        return;
      }

      setMessageTimeline(
        (data ?? []).map((item) => ({
          id: item.id,
          direction: item.direction,
          body: item.body,
          status: item.status,
          createdAt: item.created_at,
        })),
      );
      setMessagesLoading(false);
    }
    loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    async function loadCompanySettings() {
      if (!session?.access_token || !activeCompanyId) return;
      setSettingsLoading(true);

      const response = await fetch(`/api/company-ai-settings?company_id=${activeCompanyId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = (await response.json()) as {
        company?: {
          name?: string;
          settings_json?: {
            ai?: {
              assistant_name?: string;
              tone?: string;
              welcome_enabled?: boolean;
              welcome_message?: string;
              business?: { name?: string; description?: string; hours?: string; faq?: Array<{ question?: string; answer?: string }> };
            };
          };
        };
        detail?: string;
      };

      if (!response.ok) {
        setMessage(`Falha ao carregar configuracoes da IA: ${payload.detail ?? "erro"}`);
        setSettingsLoading(false);
        return;
      }

      const ai = payload.company?.settings_json?.ai;
      const business = ai?.business;
      setAssistantName(ai?.assistant_name ?? "Atendente IA");
      setTone(ai?.tone ?? "consultivo e objetivo");
      setWelcomeEnabled(ai?.welcome_enabled ?? true);
      setWelcomeMessage(ai?.welcome_message ?? "Oi! Sou o assistente virtual da empresa. Como posso ajudar?");
      setBusinessName(business?.name ?? payload.company?.name ?? "");
      setBusinessDescription(business?.description ?? "");
      setBusinessHours(business?.hours ?? "Seg-Sex 08h-18h");
      setFaqText(
        (business?.faq ?? [])
          .map((item) => `${item.question ?? ""}|${item.answer ?? ""}`)
          .filter((line) => line !== "|")
          .join("\n") || "Formate como: pergunta|resposta",
      );

      setSettingsLoading(false);
    }

    loadCompanySettings();
  }, [activeCompanyId, session?.access_token]);

  async function createFirstCompany() {
    if (!supabase || !session?.access_token) return;
    if (companyNameInput.trim().length < 2 || companySlugInput.trim().length < 3) {
      setMessage("Informe nome e slug validos para criar a empresa.");
      return;
    }
    setOnboardingLoading(true);
    const response = await fetch("/api/onboarding-company", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: companyNameInput.trim(), slug: companySlugInput.trim().toLowerCase() }),
    });
    const payload = (await response.json()) as { error?: string; detail?: string };
    if (!response.ok) {
      setMessage(`Falha no onboarding: ${payload.detail ?? payload.error ?? "erro desconhecido"}`);
      setOnboardingLoading(false);
      return;
    }
    setCompanyNameInput("");
    setCompanySlugInput("");
    await loadMemberships();
    setOnboardingLoading(false);
  }

  async function saveAiSettings() {
    if (!session?.access_token || !activeCompanyId) return;

    const faq = faqText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes("|"))
      .map((line) => {
        const [question, ...rest] = line.split("|");
        return { question: question.trim(), answer: rest.join("|").trim() };
      })
      .filter((item) => item.question.length > 1 && item.answer.length > 1);

    setSettingsSaving(true);
    const response = await fetch(`/api/company-ai-settings?company_id=${activeCompanyId}`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        assistantName,
        tone,
        welcomeEnabled,
        welcomeMessage,
        businessName,
        businessDescription,
        businessHours,
        faq,
      }),
    });
    const payload = (await response.json()) as { detail?: string };
    if (!response.ok) {
      setMessage(`Falha ao salvar configuracoes: ${payload.detail ?? "erro"}`);
      setSettingsSaving(false);
      return;
    }
    setMessage("Configuracoes salvas com sucesso.");
    setSettingsSaving(false);
  }

  async function runAiPreview() {
    const companyId = activeCompanyId || memberships[0]?.companyId;
    if (!session?.access_token || !companyId) return;
    setPreviewLoading(true);
    setPreviewStatus("");

    try {
      const response = await fetch("/api/company-ai-preview", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ companyId, customerMessage: previewInput }),
      });
      const payload = (await response.json()) as { response?: string; detail?: string; error?: string };
      setPreviewStatus(`HTTP ${response.status}`);
      if (!response.ok) {
        setPreviewOutput(`Falha no teste: ${payload.detail ?? payload.error ?? "erro"}`);
      } else {
        setPreviewOutput(payload.response ?? "Sem resposta");
      }
    } catch (error) {
      setPreviewOutput(`Erro de rede: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      setPreviewStatus("Erro de rede");
    }

    setPreviewLoading(false);
  }

  async function loginWithGoogle() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setMessage(error.message);
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  const activeMembership = useMemo(
    () => memberships.find((item) => item.companyId === activeCompanyId) ?? memberships[0],
    [activeCompanyId, memberships],
  );

  const statusCards = [
    { title: "OpenAI", value: import.meta.env.VITE_USE_MOCK_OPENAI === "true" ? "Mock ativo" : "Pendente", help: "Chave por tenant e rotacao segura." },
    { title: "WhatsApp", value: import.meta.env.VITE_USE_MOCK_WHATSAPP === "true" ? "Mock ativo" : "Pendente", help: "Webhook validado e assinatura HMAC." },
    { title: "Supabase", value: isSupabaseConfigured ? "Conectado" : "Nao configurado", help: "Auth + banco com isolamento por empresa." },
    { title: "Disponibilidade", value: "99.9% alvo", help: "Arquitetura serverless com fallback." },
  ];

  if (loading) return <main className="auth-shell">Carregando sessao...</main>;

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">AutomacaoZap Platform</p>
          <h1>Painel interno para operar atendimento com IA</h1>
          <p className="muted">Visual e fluxo profissional para times de operacao, suporte e growth.</p>
          {!isSupabaseConfigured ? <p className="alert">Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.</p> : null}
          <button className="btn primary" onClick={loginWithGoogle}>Continuar com Google</button>
          {message ? <p className="muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">AutomacaoZap</div>
        <p className="workspace">{activeMembership?.companyName ?? "Sem empresa"}</p>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={`nav-btn ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>{session.user.email}</p>
          <button className="btn ghost" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="content">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <header className="topbar">
          <div>
            <h2>Painel SaaS Interno</h2>
            <p className="muted">Operacao multiempresa com seguranca, observabilidade e automacao.</p>
          </div>
          <div className="company-picker">
            {membershipsLoading ? <span className="pill">Carregando...</span> : null}
            {!membershipsLoading && memberships.length > 1 ? (
              <select value={activeMembership?.companyId} onChange={(event) => setActiveCompanyId(event.target.value)}>
                {memberships.map((item) => (
                  <option key={item.companyId} value={item.companyId}>{item.companyName}</option>
                ))}
              </select>
            ) : null}
            <span className="pill">Role: {activeMembership?.role ?? "-"}</span>
          </div>
        </header>

        {memberships.length === 0 ? (
          <section className="panel page-enter reveal">
            <h3>Onboarding da primeira empresa</h3>
            <p className="muted">Crie sua empresa para liberar IA, integrações e inbox.</p>
            <div className="form-row">
              <input value={companyNameInput} onChange={(event) => setCompanyNameInput(event.target.value)} placeholder="Nome da empresa" />
              <input value={companySlugInput} onChange={(event) => setCompanySlugInput(event.target.value)} placeholder="slug-da-empresa" />
              <button className="btn primary" onClick={createFirstCompany} disabled={onboardingLoading}>{onboardingLoading ? "Criando..." : "Criar empresa"}</button>
            </div>
          </section>
        ) : null}

        {page === "dashboard" ? (
          <>
            <section className="hero-strip page-enter reveal">
              <article className="hero-block lift">
                <p>Performance semanal</p>
                <strong>+23.4%</strong>
                <small>mais conversas concluídas automaticamente</small>
              </article>
              <article className="hero-block lift">
                <p>Tempo médio de resposta</p>
                <strong>1.7s</strong>
                <small>com fallback ativo para alta disponibilidade</small>
              </article>
              <article className="hero-block lift">
                <p>Custo por atendimento</p>
                <strong>US$ 0.09</strong>
                <small>otimizado por contexto e memória incremental</small>
              </article>
            </section>
            <section className="kpi-grid page-enter reveal">
              {statusCards.map((card) => (
                <article className="kpi-card lift" key={card.title}>
                  <p>{card.title}</p>
                  <strong>{card.value}</strong>
                  <small>{card.help}</small>
                </article>
              ))}
            </section>
            <section className="panel two-col page-enter reveal">
              <div>
                <h3>Alertas operacionais</h3>
                <ul className="list">
                  <li>Webhook em modo estavel com validacao de assinatura.</li>
                  <li>Tenant scope obrigatorio pendente em todos endpoints.</li>
                  <li>OpenAI e WhatsApp em modo mock para desenvolvimento.</li>
                </ul>
              </div>
              <div>
                <h3>Progresso do produto</h3>
                <ul className="list">
                  <li>Base do frontend e backend criada.</li>
                  <li>Painel interno estruturado em modulos reais.</li>
                  <li>Proximo bloco: persistencia completa e RLS.</li>
                </ul>
              </div>
            </section>
          </>
        ) : null}

        {page === "inbox" ? (
          <section className="panel inbox-layout page-enter reveal">
            <div className="inbox-list">
              <h3>Conversas</h3>
              {conversationsLoading ? <p className="muted">Carregando conversas...</p> : null}
              {!conversationsLoading && conversationItems.length === 0 ? <p className="muted">Ainda sem conversas.</p> : null}
              {conversationItems.map((item) => (
                <button key={item.id} className={`thread lift ${activeConversationId === item.id ? "active" : ""}`} onClick={() => setActiveConversationId(item.id)}>
                  <strong>{item.phone}</strong>
                  <p>{item.lastText}</p>
                  <small>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString("pt-BR") : "Sem data"}</small>
                </button>
              ))}
            </div>
            <div className="timeline">
              <h3>Timeline</h3>
              {messagesLoading ? <p className="muted">Carregando mensagens...</p> : null}
              {!messagesLoading && messageTimeline.length === 0 ? <p className="muted">Selecione uma conversa para visualizar.</p> : null}
              {!messagesLoading
                ? messageTimeline.map((msg) => (
                    <article key={msg.id} className={`bubble lift ${msg.direction === "outbound" ? "out" : "in"}`}>
                      <p>{msg.body}</p>
                      <small>{msg.status} - {new Date(msg.createdAt).toLocaleString("pt-BR")}</small>
                    </article>
                  ))
                : null}
            </div>
          </section>
        ) : null}

        {page === "ai" ? (
          <section className="panel two-col page-enter reveal">
            <div>
              <h3>Configuração da IA</h3>
              {settingsLoading ? <p className="muted">Carregando...</p> : null}
              <div className="form-grid">
                <input value={assistantName} onChange={(event) => setAssistantName(event.target.value)} placeholder="Nome do agente" />
                <input value={tone} onChange={(event) => setTone(event.target.value)} placeholder="Tom de voz" />
                <label className="checkbox-row"><input type="checkbox" checked={welcomeEnabled} onChange={(event) => setWelcomeEnabled(event.target.checked)} /> Boas-vindas automáticas</label>
                <textarea rows={3} value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} placeholder="Mensagem inicial" />
                <button className="btn primary" onClick={saveAiSettings} disabled={settingsSaving}>{settingsSaving ? "Salvando..." : "Salvar IA"}</button>
              </div>
            </div>
            <div>
              <h3>Teste rápido da IA</h3>
              <div className="form-grid">
                <textarea rows={5} value={previewInput} onChange={(event) => setPreviewInput(event.target.value)} placeholder="Mensagem de cliente" />
                <button className="btn primary" onClick={runAiPreview} disabled={previewLoading}>{previewLoading ? "Testando..." : "Executar teste"}</button>
                {previewStatus ? <p className="muted">Status: {previewStatus}</p> : null}
                {previewOutput ? <div className="output-box">{previewOutput}</div> : null}
              </div>
            </div>
          </section>
        ) : null}

        {page === "integrations" ? (
          <section className="panel two-col page-enter reveal">
            <div>
              <h3>OpenAI</h3>
              <p className="muted">API key por tenant, validacao e rotacao.</p>
              <div className="inline-status"><span className="dot amber" /> Modo atual: {import.meta.env.VITE_USE_MOCK_OPENAI === "true" ? "mock" : "real pendente"}</div>
              <button className="btn ghost">Configurar chave</button>
            </div>
            <div>
              <h3>WhatsApp Cloud API</h3>
              <p className="muted">Webhook, verify token e assinatura HMAC.</p>
              <div className="inline-status"><span className="dot green" /> Endpoint pronto: `/.netlify/functions/whatsapp-webhook`</div>
              <button className="btn ghost">Validar integração</button>
            </div>
          </section>
        ) : null}

        {page === "knowledge" ? (
          <section className="panel page-enter reveal">
            <h3>Base de conhecimento</h3>
            <p className="muted">Gestao de FAQ, documentos e contexto de respostas.</p>
            <div className="form-grid">
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Nome da empresa" />
              <input value={businessHours} onChange={(event) => setBusinessHours(event.target.value)} placeholder="Horario de atendimento" />
              <textarea rows={4} value={businessDescription} onChange={(event) => setBusinessDescription(event.target.value)} placeholder="Descrição de serviços e público" />
              <textarea rows={6} value={faqText} onChange={(event) => setFaqText(event.target.value)} placeholder="FAQ por linha: pergunta|resposta" />
              <button className="btn primary" onClick={saveAiSettings} disabled={settingsSaving}>{settingsSaving ? "Salvando..." : "Salvar base"}</button>
            </div>
          </section>
        ) : null}

        {page === "clients" ? (
          <section className="panel page-enter reveal">
            <h3>Clientes</h3>
            <p className="muted">Segmentação, consentimento LGPD e resumo de memória.</p>
            <div className="table-head">
              <span>Nome</span><span>Telefone</span><span>Tags</span><span>Status</span>
            </div>
            <div className="table-row"><span>Maria Souza</span><span>+55 11 98888-0001</span><span>VIP</span><span>Ativo</span></div>
            <div className="table-row"><span>Gabriel Lima</span><span>+55 21 97777-0045</span><span>Lead</span><span>Novo</span></div>
            <div className="table-row"><span>Patricia Alves</span><span>+55 31 96666-9932</span><span>Recorrente</span><span>Ativo</span></div>
          </section>
        ) : null}

        {page === "logs" ? (
          <section className="panel page-enter reveal">
            <h3>Logs e auditoria</h3>
            <p className="muted">Eventos com correlation id, status e origem.</p>
            <div className="table-head">
              <span>Data</span><span>Evento</span><span>Severidade</span><span>Correlation ID</span>
            </div>
            <div className="table-row"><span>Hoje 14:03</span><span>Webhook recebido</span><span>info</span><span>cid_84h1a2</span></div>
            <div className="table-row"><span>Hoje 13:40</span><span>Falha OpenAI fallback</span><span>warn</span><span>cid_84g7tf</span></div>
            <div className="table-row"><span>Hoje 12:11</span><span>Rotacao de segredo</span><span>security</span><span>cid_84c1xp</span></div>
          </section>
        ) : null}

        {page === "settings" ? (
          <section className="panel two-col page-enter reveal">
            <div>
              <h3>Membros e permissões</h3>
              <ul className="list">
                <li>owner: controle total de billing e segredos.</li>
                <li>admin: operação e integrações da empresa.</li>
                <li>operator: atendimento e conversas.</li>
                <li>viewer: leitura de métricas e histórico.</li>
              </ul>
            </div>
            <div>
              <h3>Segurança</h3>
              <ul className="list">
                <li>Isolamento por `company_id` em todos endpoints.</li>
                <li>Segredos criptografados com AES-256-GCM.</li>
                <li>Webhook com verify token e assinatura.</li>
              </ul>
            </div>
          </section>
        ) : null}

        {message ? <p className="banner">{message}</p> : null}
      </main>
    </div>
  );
}
