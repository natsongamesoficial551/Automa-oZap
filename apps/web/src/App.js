import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
function statusLabel(mode) {
    if (mode === "mock")
        return "Mock ativo";
    return "Pendente";
}
export function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authMessage, setAuthMessage] = useState(null);
    const [memberships, setMemberships] = useState([]);
    const [membershipsLoading, setMembershipsLoading] = useState(false);
    const [activeCompanyId, setActiveCompanyId] = useState("");
    const [companyNameInput, setCompanyNameInput] = useState("");
    const [companySlugInput, setCompanySlugInput] = useState("");
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationItems, setConversationItems] = useState([]);
    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
        });
        return () => subscription.unsubscribe();
    }, []);
    const cards = useMemo(() => [
        {
            title: "OpenAI",
            mode: (import.meta.env.VITE_USE_MOCK_OPENAI === "true" ? "mock" : "pending"),
            todo: "TODO[OPENAI-ACCESS-01]: cadastrar API key real por tenant em staging."
        },
        {
            title: "WhatsApp",
            mode: (import.meta.env.VITE_USE_MOCK_WHATSAPP === "true" ? "mock" : "pending"),
            todo: "TODO[WPP-ACCESS-01]: configurar credenciais Meta reais por tenant."
        },
        {
            title: "Banco",
            mode: "pending",
            todo: "TODO[DB-SETUP-01]: provisionar Postgres/Supabase e aplicar migrations."
        }
    ], []);
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
            const company = item.company;
            const role = item.role;
            if (!company?.id || !company?.name || !role) {
                return null;
            }
            return {
                companyId: company.id,
                companyName: company.name,
                role
            };
        })
            .filter((item) => item !== null);
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
            const latestByConversation = new Map();
            for (const message of messages ?? []) {
                if (!latestByConversation.has(message.conversation_id)) {
                    latestByConversation.set(message.conversation_id, message.body);
                }
            }
            setConversationItems((conversations ?? []).map((conv) => ({
                id: conv.id,
                phone: conv.customer_phone,
                lastMessageAt: conv.last_message_at,
                lastText: latestByConversation.get(conv.id) ?? "Sem mensagens"
            })));
            setConversationsLoading(false);
        }
        loadConversations();
    }, [activeCompanyId]);
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
        const payload = (await response.json());
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
    const activeMembership = useMemo(() => memberships.find((item) => item.companyId === activeCompanyId) ?? memberships[0], [activeCompanyId, memberships]);
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
        if (!supabase)
            return;
        await supabase.auth.signOut();
    }
    if (loading) {
        return _jsx("main", { className: "layout", children: "Carregando sessao..." });
    }
    if (!session) {
        return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "kicker", children: "AutomacaoZap" }), _jsx("h1", { children: "Acesso ao painel" }), _jsx("p", { className: "description", children: "Entre para gerenciar empresas, integracoes e atendimento com IA." })] }), _jsxs("section", { className: "card auth-card", children: [_jsx("h2", { children: "Entrar com Google" }), !isSupabaseConfigured && (_jsx("p", { className: "todo", children: "Modo fallback: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`." })), _jsx("p", { className: "todo", children: "A autenticacao por email/senha foi desativada. Use sua conta Google." }), _jsx("button", { className: "google-btn", onClick: loginWithGoogle, children: "Continuar com Google" }), authMessage ? _jsx("p", { className: "todo", children: authMessage }) : null] })] }));
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "kicker", children: "AutomacaoZap" }), _jsx("h1", { children: "SaaS de atendimento com IA no WhatsApp" }), _jsx("p", { className: "description", children: "Base inicial pronta para evoluir em blocos: multiempresa, integra\u00E7\u00F5es com fallback e deploy em Netlify." }), _jsxs("p", { className: "description", children: ["Sessao: ", _jsx("strong", { children: session.user.email })] }), _jsx("button", { className: "link-btn", onClick: logout, children: "Sair" })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "Empresa ativa" }), membershipsLoading ? _jsx("p", { className: "todo", children: "Carregando memberships..." }) : null, !membershipsLoading && memberships.length > 0 && activeMembership ? (_jsxs(_Fragment, { children: [memberships.length > 1 ? (_jsx("select", { className: "company-select", value: activeMembership.companyId, onChange: (e) => setActiveCompanyId(e.target.value), children: memberships.map((item) => (_jsx("option", { value: item.companyId, children: item.companyName }, item.companyId))) })) : null, _jsx("p", { className: "status", children: activeMembership.companyName }), _jsxs("p", { className: "todo", children: ["Role: ", activeMembership.role] })] })) : null, !membershipsLoading && memberships.length === 0 ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "status", children: "Nenhuma empresa vinculada" }), _jsx("p", { className: "todo", children: "Vamos criar sua primeira empresa agora para concluir onboarding." }), _jsxs("div", { className: "onboarding-form", children: [_jsx("input", { type: "text", placeholder: "Nome da empresa", value: companyNameInput, onChange: (e) => setCompanyNameInput(e.target.value) }), _jsx("input", { type: "text", placeholder: "slug-da-empresa", value: companySlugInput, onChange: (e) => setCompanySlugInput(e.target.value) }), _jsx("button", { className: "google-btn", onClick: createFirstCompany, disabled: onboardingLoading, children: onboardingLoading ? "Criando..." : "Criar empresa" })] })] })) : null] }), _jsx("section", { className: "grid", children: cards.map((card) => (_jsxs("article", { className: "card", children: [_jsx("h2", { children: card.title }), _jsx("p", { className: "status", children: statusLabel(card.mode) }), _jsx("p", { className: "todo", children: card.todo })] }, card.title))) }), _jsxs("section", { className: "card conversations-card", children: [_jsx("h2", { children: "Conversas recentes" }), conversationsLoading ? _jsx("p", { className: "todo", children: "Carregando conversas..." }) : null, !conversationsLoading && conversationItems.length === 0 ? _jsx("p", { className: "todo", children: "Ainda sem conversas para esta empresa." }) : null, !conversationsLoading && conversationItems.length > 0
                        ? conversationItems.map((item) => (_jsxs("article", { className: "conversation-item", children: [_jsx("p", { className: "status", children: item.phone }), _jsx("p", { className: "todo", children: item.lastText }), _jsx("p", { className: "todo", children: item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString("pt-BR") : "Sem data" })] }, item.id)))
                        : null] })] }));
}
