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
    const [activeConversationId, setActiveConversationId] = useState("");
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [messageTimeline, setMessageTimeline] = useState([]);
    const [page, setPage] = useState("dashboard");
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
            setMessageTimeline((data ?? []).map((item) => ({
                id: item.id,
                direction: item.direction,
                body: item.body,
                status: item.status,
                createdAt: item.created_at
            })));
            setMessagesLoading(false);
        }
        loadMessages();
    }, [activeConversationId]);
    useEffect(() => {
        async function loadCompanySettings() {
            if (!session?.access_token || !activeCompanyId)
                return;
            setSettingsLoading(true);
            const response = await fetch(`/api/company-ai-settings?company_id=${activeCompanyId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const payload = (await response.json());
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
            setFaqText((business?.faq ?? [])
                .map((item) => `${item.question ?? ""}|${item.answer ?? ""}`)
                .filter((line) => line !== "|")
                .join("\n") || "Formate como: pergunta|resposta");
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
        const payload = (await response.json());
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
            const payload = (await response.json());
            if (!response.ok) {
                setPreviewOutput(`Falha no teste: ${payload.detail ?? payload.error ?? "erro"}`);
                setPreviewLoading(false);
                return;
            }
            setPreviewOutput(payload.response ?? "Sem resposta");
            setPreviewLoading(false);
        }
        catch (error) {
            setPreviewOutput(`Falha no teste: ${error instanceof Error ? error.message : "erro de rede"}`);
            setPreviewLoading(false);
        }
    }
    if (loading) {
        return _jsx("main", { className: "layout", children: "Carregando sessao..." });
    }
    if (!session) {
        return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "kicker", children: "AutomacaoZap" }), _jsx("h1", { children: "Acesso ao painel" }), _jsx("p", { className: "description", children: "Entre para gerenciar empresas, integracoes e atendimento com IA." })] }), _jsxs("section", { className: "card auth-card", children: [_jsx("h2", { children: "Entrar com Google" }), !isSupabaseConfigured && (_jsx("p", { className: "todo", children: "Modo fallback: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`." })), _jsx("p", { className: "todo", children: "A autenticacao por email/senha foi desativada. Use sua conta Google." }), _jsx("button", { className: "google-btn", onClick: loginWithGoogle, children: "Continuar com Google" }), authMessage ? _jsx("p", { className: "todo", children: authMessage }) : null] })] }));
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "kicker", children: "AutomacaoZap" }), _jsx("h1", { children: "SaaS de atendimento com IA no WhatsApp" }), _jsx("p", { className: "description", children: "Base inicial pronta para evoluir em blocos: multiempresa, integra\u00E7\u00F5es com fallback e deploy em Netlify." }), _jsxs("p", { className: "description", children: ["Sessao: ", _jsx("strong", { children: session.user.email })] }), _jsx("button", { className: "link-btn", onClick: logout, children: "Sair" }), _jsxs("div", { className: "tabs", children: [_jsx("button", { className: `tab-btn ${page === "dashboard" ? "active" : ""}`, onClick: () => setPage("dashboard"), children: "Dashboard" }), _jsx("button", { className: `tab-btn ${page === "ai" ? "active" : ""}`, onClick: () => setPage("ai"), children: "IA WhatsApp" }), _jsx("button", { className: `tab-btn ${page === "company" ? "active" : ""}`, onClick: () => setPage("company"), children: "Dados empresa" })] })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "Empresa ativa" }), membershipsLoading ? _jsx("p", { className: "todo", children: "Carregando memberships..." }) : null, !membershipsLoading && memberships.length > 0 && activeMembership ? (_jsxs(_Fragment, { children: [memberships.length > 1 ? (_jsx("select", { className: "company-select", value: activeMembership.companyId, onChange: (e) => setActiveCompanyId(e.target.value), children: memberships.map((item) => (_jsx("option", { value: item.companyId, children: item.companyName }, item.companyId))) })) : null, _jsx("p", { className: "status", children: activeMembership.companyName }), _jsxs("p", { className: "todo", children: ["Role: ", activeMembership.role] })] })) : null, !membershipsLoading && memberships.length === 0 ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "status", children: "Nenhuma empresa vinculada" }), _jsx("p", { className: "todo", children: "Vamos criar sua primeira empresa agora para concluir onboarding." }), _jsxs("div", { className: "onboarding-form", children: [_jsx("input", { type: "text", placeholder: "Nome da empresa", value: companyNameInput, onChange: (e) => setCompanyNameInput(e.target.value) }), _jsx("input", { type: "text", placeholder: "slug-da-empresa", value: companySlugInput, onChange: (e) => setCompanySlugInput(e.target.value) }), _jsx("button", { className: "google-btn", onClick: createFirstCompany, disabled: onboardingLoading, children: onboardingLoading ? "Criando..." : "Criar empresa" })] })] })) : null] }), page === "dashboard" ? _jsx("section", { className: "grid", children: cards.map((card) => (_jsxs("article", { className: "card", children: [_jsx("h2", { children: card.title }), _jsx("p", { className: "status", children: statusLabel(card.mode) }), _jsx("p", { className: "todo", children: card.todo })] }, card.title))) }) : null, page === "ai" ? (_jsxs("section", { className: "card settings-card", children: [_jsx("h2", { children: "Configura\u00E7\u00E3o da IA no WhatsApp" }), settingsLoading ? _jsx("p", { className: "todo", children: "Carregando configura\u00E7\u00F5es..." }) : null, !settingsLoading ? (_jsxs("div", { className: "settings-grid", children: [_jsx("input", { value: assistantName, onChange: (e) => setAssistantName(e.target.value), placeholder: "Nome do assistente" }), _jsx("input", { value: modelName, onChange: (e) => setModelName(e.target.value), placeholder: "Modelo (ex: gpt-4.1-mini)" }), _jsx("input", { value: tone, onChange: (e) => setTone(e.target.value), placeholder: "Tom de voz" }), _jsxs("label", { className: "toggle-row", children: [_jsx("input", { type: "checkbox", checked: welcomeEnabled, onChange: (e) => setWelcomeEnabled(e.target.checked) }), "Mensagem autom\u00E1tica inicial"] }), _jsx("textarea", { value: welcomeMessage, onChange: (e) => setWelcomeMessage(e.target.value), rows: 3, placeholder: "Mensagem inicial" }), _jsx("button", { className: "google-btn", onClick: saveAiSettings, disabled: settingsSaving, children: settingsSaving ? "Salvando..." : "Salvar configuração da IA" }), _jsx("hr", {}), _jsx("h3", { children: "Teste r\u00E1pido da resposta" }), _jsx("textarea", { value: previewInput, onChange: (e) => setPreviewInput(e.target.value), rows: 3, placeholder: "Digite mensagem de cliente" }), _jsx("button", { className: "google-btn", onClick: runAiPreview, disabled: previewLoading, children: previewLoading ? "Testando..." : "Testar resposta da IA" }), previewOutput ? _jsx("p", { className: "todo", children: previewOutput }) : null] })) : null] })) : null, page === "company" ? (_jsxs("section", { className: "card settings-card", children: [_jsx("h2", { children: "Dados da empresa para contexto da IA" }), _jsxs("div", { className: "settings-grid", children: [_jsx("input", { value: businessName, onChange: (e) => setBusinessName(e.target.value), placeholder: "Nome da empresa" }), _jsx("input", { value: businessHours, onChange: (e) => setBusinessHours(e.target.value), placeholder: "Hor\u00E1rio de atendimento" }), _jsx("textarea", { value: businessDescription, onChange: (e) => setBusinessDescription(e.target.value), rows: 5, placeholder: "Descreva servi\u00E7os, p\u00FAblico e regras de atendimento" }), _jsx("textarea", { value: faqText, onChange: (e) => setFaqText(e.target.value), rows: 6, placeholder: "Uma FAQ por linha: pergunta|resposta" }), _jsx("button", { className: "google-btn", onClick: saveAiSettings, disabled: settingsSaving, children: settingsSaving ? "Salvando..." : "Salvar dados da empresa" })] })] })) : null, _jsxs("section", { className: "card conversations-card", children: [_jsx("h2", { children: "Conversas recentes" }), conversationsLoading ? _jsx("p", { className: "todo", children: "Carregando conversas..." }) : null, !conversationsLoading && conversationItems.length === 0 ? _jsx("p", { className: "todo", children: "Ainda sem conversas para esta empresa." }) : null, !conversationsLoading && conversationItems.length > 0 ? (_jsxs("div", { className: "conversations-layout", children: [_jsx("div", { children: conversationItems.map((item) => (_jsxs("button", { type: "button", className: `conversation-item ${activeConversationId === item.id ? "active" : ""}`, onClick: () => setActiveConversationId(item.id), children: [_jsx("p", { className: "status", children: item.phone }), _jsx("p", { className: "todo", children: item.lastText }), _jsx("p", { className: "todo", children: item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString("pt-BR") : "Sem data" })] }, item.id))) }), _jsxs("div", { className: "timeline-panel", children: [_jsx("h3", { children: "Timeline da conversa" }), messagesLoading ? _jsx("p", { className: "todo", children: "Carregando mensagens..." }) : null, !messagesLoading && messageTimeline.length === 0 ? _jsx("p", { className: "todo", children: "Sem mensagens na conversa selecionada." }) : null, !messagesLoading
                                        ? messageTimeline.map((msg) => (_jsxs("article", { className: `message-bubble ${msg.direction === "outbound" ? "out" : "in"}`, children: [_jsx("p", { className: "todo", children: msg.body }), _jsxs("p", { className: "todo", children: [msg.status, " \u2022 ", new Date(msg.createdAt).toLocaleString("pt-BR")] })] }, msg.id)))
                                        : null] })] })) : null] })] }));
}
