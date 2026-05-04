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

  const memberships: CompanyMembership[] = useMemo(
    () => [
      {
        companyId: "todo-company-id",
        companyName: "Empresa pendente de provisioning",
        role: "owner"
      }
    ],
    []
  );

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
        <p className="status">{memberships[0].companyName}</p>
        <p className="todo">Role: {memberships[0].role}</p>
        <p className="todo">TODO[TENANT-SCHEMA-01]: persistir companies e memberships no Supabase.</p>
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
