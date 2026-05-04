import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { CompanyMembership } from "./types";

type StatusMode = "mock" | "pending";
type PanelPage = "dashboard" | "ai" | "company";

function statusLabel(mode: StatusMode): string {
  if (mode === "mock") return "Mock ativo";
  return "Pendente";
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");
  const [companyNameInput, setCompanyNameInput] = useState("");
  const [companySlugInput, setCompanySlugInput] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationItems, setConversationItems] = useState<Array<{ id: string; phone: string; lastMessageAt: string | null; lastText: string }>>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageTimeline, setMessageTimeline] = useState<Array<{ id: string; direction: string; body: string; status: string; createdAt: string }>>([]);
  const [page, setPage] = useState<PanelPage>("dashboard");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [assistantName, setAssistantName] = useState("Atendente IA");
  const [modelName, setModelName] = useState("gpt-4.1-mini");
  const [tone, setTone] = useState("profissional e simpatico");
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("Oi! Sou o assistente virtual da empresa. Como posso ajudar?");
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessHours, setBusinessHours] = useState("Seg-Sex 08h-18h");
  const [faqText, setFaqText] = useState("Formate como: pergunta|resposta");
  const [previewInput, setPreviewInput] = useState("Quero saber horarios e formas de pagamento.");
  const [previewOutput, setPreviewOutput] = useState("");
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

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "OpenAI",
        mode: (import.meta.env.VITE_USE_MOCK_OPENAI === "true" ? "mock" : "pending") as StatusMode,
        todo: "TODO[OPENAI-ACCESS-01]: cadastrar API key real por tenant em staging."
      },
      {
        title: "WhatsApp",
        mode: (import.meta.env.VITE_USE_MOCK_WHATSAPP === "true" ? "mock" : "pending") as StatusMode,
        todo: "TODO[WPP-ACCESS-01]: configurar credenciais Meta reais por tenant."
      },
      {
        title: "Banco",
        mode: "pending" as StatusMode,
        todo: "TODO[DB-SETUP-01]: provisionar Postgres/Supabase e aplicar migrations."
      }
    ],
    []
  );

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
      setAuthMessage(`Falha ao carregar memberships: ${error.message}`);
      setMemberships([]);
      setMembershipsLoading(false);
      return;
    }

    const mapped = (data ?? [])
      .map((item) => {
        const company = (item as { company?: { id?: string; name?: string } }).company;
        const role = (item as { role?: CompanyMembership["role"] }).role;

        if (!company?.id || !company?.name || !role) {
          return null;
        }

        return {
          companyId: company.id,
          companyName: company.name,
          role
        } satisfies CompanyMembership;
      })
      .filter((item): item is CompanyMembership => item !== null);

    setMemberships(mapped);
    setMembershipsLoading(false);
  }

  useEffect(() => {
    loadMemberships();
  }, [session?.user.id]);

  useEffect(() => {
    if (!activeCompanyId && memberships.length > 0) {
      setActiveCompanyId(memberships[0].companyId);
    }
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
        .limit(10);

      if (convError) {
        setAuthMessage(`Falha ao carregar conversas: ${convError.message}`);
        setConversationItems([]);
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
        setAuthMessage(`Falha ao carregar mensagens: ${msgError.message}`);
        setConversationItems([]);
        setConversationsLoading(false);
        return;
      }

      const latestByConversation = new Map<string, string>();
      for (const message of messages ?? []) {
        if (!latestByConversation.has(message.conversation_id)) {
          latestByConversation.set(message.conversation_id, message.body);
        }
      }

      setConversationItems(
        (conversations ?? []).map((conv) => ({
          id: conv.id,
          phone: conv.customer_phone,
          lastMessageAt: conv.last_message_at,
          lastText: latestByConversation.get(conv.id) ?? "Sem mensagens"
        }))
      );
      if (conversations.length > 0 && !activeConversationId) {
        setActiveConversationId(conversations[0].id);
      }
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
        setAuthMessage(`Falha ao carregar timeline: ${error.message}`);
        setMessageTimeline([]);
        setMessagesLoading(false);
        return;
      }

      setMessageTimeline(
        (data ?? []).map((item) => ({
          id: item.id,
          direction: item.direction,
          body: item.body,
          status: item.status,
          createdAt: item.created_at
        }))
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
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      const payload = (await response.json()) as {
        company?: {
          name?: string;
          settings_json?: {
            ai?: {
              assistant_name?: string;
              model?: string;
              tone?: string;
              welcome_enabled?: boolean;
              welcome_message?: string;
              business?: {
                name?: string;
                description?: string;
                hours?: string;
                faq?: Array<{ question?: string; answer?: string }>;
              };
            };
          };
        };
        detail?: string;
      };

      if (!response.ok) {
        setAuthMessage(`Falha ao carregar configuracoes da IA: ${payload.detail ?? "erro"}`);
        setSettingsLoading(false);
        return;
      }

      const ai = payload.company?.settings_json?.ai;
      const business = ai?.business;

      setAssistantName(ai?.assistant_name ?? "Atendente IA");
      setModelName(ai?.model ?? "gpt-4.1-mini");
      setTone(ai?.tone ?? "profissional e simpatico");
      setWelcomeEnabled(ai?.welcome_enabled ?? true);
      setWelcomeMessage(ai?.welcome_message ?? "Oi! Sou o assistente virtual da empresa. Como posso ajudar?");
      setBusinessName(business?.name ?? payload.company?.name ?? "");
      setBusinessDescription(business?.description ?? "");
      setBusinessHours(business?.hours ?? "Seg-Sex 08h-18h");
      setFaqText(
        (business?.faq ?? [])
          .map((item) => `${item.question ?? ""}|${item.answer ?? ""}`)
          .filter((line) => line !== "|")
          .join("\n") || "Formate como: pergunta|resposta"
      );

      setSettingsLoading(false);
    }

    loadCompanySettings();
  }, [activeCompanyId, session?.access_token]);

  async function createFirstCompany() {
    if (!supabase || !session?.access_token) {
      setAuthMessage("Sessao invalida para onboarding.");
      return;
    }

    if (companyNameInput.trim().length < 2 || companySlugInput.trim().length < 3) {
      setAuthMessage("Informe nome e slug validos para criar a empresa.");
      return;
    }

    setOnboardingLoading(true);
    setAuthMessage(null);

    const response = await fetch("/api/onboarding-company", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        name: companyNameInput.trim(),
        slug: companySlugInput.trim().toLowerCase()
      })
    });

    const payload = (await response.json()) as { error?: string; detail?: string };

    if (!response.ok) {
      setAuthMessage(`Falha no onboarding: ${payload.detail ?? payload.error ?? "erro desconhecido"}`);
      setOnboardingLoading(false);
      return;
    }

    setCompanyNameInput("");
    setCompanySlugInput("");
    await loadMemberships();
    setOnboardingLoading(false);
  }

  const activeMembership = useMemo(
    () => memberships.find((item) => item.companyId === activeCompanyId) ?? memberships[0],
    [activeCompanyId, memberships]
  );

  async function loginWithGoogle() {
    setAuthMessage(null);

    if (!supabase) {
      setAuthMessage("Supabase nao configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthMessage(error.message);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function saveAiSettings() {
    if (!session?.access_token || !activeCompanyId) {
      setAuthMessage("Sessao/empresa invalida para salvar configuracoes.");
      return;
    }

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
    setAuthMessage(null);

    const response = await fetch(`/api/company-ai-settings?company_id=${activeCompanyId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        assistantName,
        model: modelName,
        tone,
        welcomeEnabled,
        welcomeMessage,
        businessName,
        businessDescription,
        businessHours,
        faq
      })
    });

    const payload = (await response.json()) as { detail?: string };
    if (!response.ok) {
      setAuthMessage(`Falha ao salvar configuracoes: ${payload.detail ?? "erro"}`);
      setSettingsSaving(false);
      return;
    }

    setAuthMessage("Configuracoes de IA salvas com sucesso.");
    setSettingsSaving(false);
  }

  async function runAiPreview() {
    const companyId = activeCompanyId || activeMembership?.companyId;
    if (!session?.access_token || !companyId) {
      setPreviewOutput("Nao foi possivel testar: sessao ou empresa ativa indisponivel.");
      return;
    }
    setPreviewLoading(true);
    try {
      const response = await fetch("/api/company-ai-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          companyId,
          customerMessage: previewInput
        })
      });

      const payload = (await response.json()) as { response?: string; detail?: string; error?: string };
      if (!response.ok) {
        setPreviewOutput(`Falha no teste: ${payload.detail ?? payload.error ?? "erro"}`);
        setPreviewLoading(false);
        return;
      }

      setPreviewOutput(payload.response ?? "Sem resposta");
      setPreviewLoading(false);
    } catch (error) {
      setPreviewOutput(`Falha no teste: ${error instanceof Error ? error.message : "erro de rede"}`);
      setPreviewLoading(false);
    }
  }

  if (loading) {
    return <main className="layout">Carregando sessao...</main>;
  }

  if (!session) {
    return (
      <main className="layout">
        <section className="hero">
          <p className="kicker">AutomacaoZap</p>
          <h1>Acesso ao painel</h1>
          <p className="description">Entre para gerenciar empresas, integracoes e atendimento com IA.</p>
        </section>

        <section className="card auth-card">
          <h2>Entrar com Google</h2>
          {!isSupabaseConfigured && (
            <p className="todo">Modo fallback: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.</p>
          )}
          <p className="todo">A autenticacao por email/senha foi desativada. Use sua conta Google.</p>
          <button className="google-btn" onClick={loginWithGoogle}>Continuar com Google</button>
          {authMessage ? <p className="todo">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="layout">
      <section className="hero">
        <p className="kicker">AutomacaoZap</p>
        <h1>SaaS de atendimento com IA no WhatsApp</h1>
        <p className="description">
          Base inicial pronta para evoluir em blocos: multiempresa, integrações com fallback e deploy em Netlify.
        </p>
        <p className="description">
          Sessao: <strong>{session.user.email}</strong>
        </p>
        <button className="link-btn" onClick={logout}>Sair</button>
        <div className="tabs">
          <button className={`tab-btn ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}>Dashboard</button>
          <button className={`tab-btn ${page === "ai" ? "active" : ""}`} onClick={() => setPage("ai")}>IA WhatsApp</button>
          <button className={`tab-btn ${page === "company" ? "active" : ""}`} onClick={() => setPage("company")}>Dados empresa</button>
        </div>
      </section>

      <section className="card">
        <h2>Empresa ativa</h2>
        {membershipsLoading ? <p className="todo">Carregando memberships...</p> : null}
        {!membershipsLoading && memberships.length > 0 && activeMembership ? (
          <>
            {memberships.length > 1 ? (
              <select className="company-select" value={activeMembership.companyId} onChange={(e) => setActiveCompanyId(e.target.value)}>
                {memberships.map((item) => (
                  <option key={item.companyId} value={item.companyId}>
                    {item.companyName}
                  </option>
                ))}
              </select>
            ) : null}
            <p className="status">{activeMembership.companyName}</p>
            <p className="todo">Role: {activeMembership.role}</p>
          </>
        ) : null}
        {!membershipsLoading && memberships.length === 0 ? (
          <>
            <p className="status">Nenhuma empresa vinculada</p>
            <p className="todo">Vamos criar sua primeira empresa agora para concluir onboarding.</p>
            <div className="onboarding-form">
              <input
                type="text"
                placeholder="Nome da empresa"
                value={companyNameInput}
                onChange={(e) => setCompanyNameInput(e.target.value)}
              />
              <input
                type="text"
                placeholder="slug-da-empresa"
                value={companySlugInput}
                onChange={(e) => setCompanySlugInput(e.target.value)}
              />
              <button className="google-btn" onClick={createFirstCompany} disabled={onboardingLoading}>
                {onboardingLoading ? "Criando..." : "Criar empresa"}
              </button>
            </div>
          </>
        ) : null}
      </section>

      {page === "dashboard" ? <section className="grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h2>{card.title}</h2>
            <p className="status">{statusLabel(card.mode)}</p>
            <p className="todo">{card.todo}</p>
          </article>
        ))}
      </section> : null}

      {page === "ai" ? (
        <section className="card settings-card">
          <h2>Configuração da IA no WhatsApp</h2>
          {settingsLoading ? <p className="todo">Carregando configurações...</p> : null}
          {!settingsLoading ? (
            <div className="settings-grid">
              <input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} placeholder="Nome do assistente" />
              <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Modelo (ex: gpt-4.1-mini)" />
              <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tom de voz" />
              <label className="toggle-row">
                <input type="checkbox" checked={welcomeEnabled} onChange={(e) => setWelcomeEnabled(e.target.checked)} />
                Mensagem automática inicial
              </label>
              <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows={3} placeholder="Mensagem inicial" />
              <button className="google-btn" onClick={saveAiSettings} disabled={settingsSaving}>
                {settingsSaving ? "Salvando..." : "Salvar configuração da IA"}
              </button>
              <hr />
              <h3>Teste rápido da resposta</h3>
              <textarea value={previewInput} onChange={(e) => setPreviewInput(e.target.value)} rows={3} placeholder="Digite mensagem de cliente" />
              <button className="google-btn" onClick={runAiPreview} disabled={previewLoading}>
                {previewLoading ? "Testando..." : "Testar resposta da IA"}
              </button>
              {previewOutput ? <p className="todo">{previewOutput}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {page === "company" ? (
        <section className="card settings-card">
          <h2>Dados da empresa para contexto da IA</h2>
          <div className="settings-grid">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Nome da empresa" />
            <input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} placeholder="Horário de atendimento" />
            <textarea
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              rows={5}
              placeholder="Descreva serviços, público e regras de atendimento"
            />
            <textarea
              value={faqText}
              onChange={(e) => setFaqText(e.target.value)}
              rows={6}
              placeholder="Uma FAQ por linha: pergunta|resposta"
            />
            <button className="google-btn" onClick={saveAiSettings} disabled={settingsSaving}>
              {settingsSaving ? "Salvando..." : "Salvar dados da empresa"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="card conversations-card">
        <h2>Conversas recentes</h2>
        {conversationsLoading ? <p className="todo">Carregando conversas...</p> : null}
        {!conversationsLoading && conversationItems.length === 0 ? <p className="todo">Ainda sem conversas para esta empresa.</p> : null}
        {!conversationsLoading && conversationItems.length > 0 ? (
          <div className="conversations-layout">
            <div>
              {conversationItems.map((item) => (
                <button
                  type="button"
                  className={`conversation-item ${activeConversationId === item.id ? "active" : ""}`}
                  onClick={() => setActiveConversationId(item.id)}
                  key={item.id}
                >
                  <p className="status">{item.phone}</p>
                  <p className="todo">{item.lastText}</p>
                  <p className="todo">{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString("pt-BR") : "Sem data"}</p>
                </button>
              ))}
            </div>

            <div className="timeline-panel">
              <h3>Timeline da conversa</h3>
              {messagesLoading ? <p className="todo">Carregando mensagens...</p> : null}
              {!messagesLoading && messageTimeline.length === 0 ? <p className="todo">Sem mensagens na conversa selecionada.</p> : null}
              {!messagesLoading
                ? messageTimeline.map((msg) => (
                    <article className={`message-bubble ${msg.direction === "outbound" ? "out" : "in"}`} key={msg.id}>
                      <p className="todo">{msg.body}</p>
                      <p className="todo">{msg.status} • {new Date(msg.createdAt).toLocaleString("pt-BR")}</p>
                    </article>
                  ))
                : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
