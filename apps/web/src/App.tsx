import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { CompanyMembership } from "./types";

type StatusMode = "mock" | "pending";

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

      <section className="grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h2>{card.title}</h2>
            <p className="status">{statusLabel(card.mode)}</p>
            <p className="todo">{card.todo}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
