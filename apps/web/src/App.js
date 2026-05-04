import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const [authMode, setAuthMode] = useState("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authMessage, setAuthMessage] = useState(null);
    const memberships = useMemo(() => [
        {
            companyId: "todo-company-id",
            companyName: "Empresa pendente de provisioning",
            role: "owner"
        }
    ], []);
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
    async function onSubmitAuth(event) {
        event.preventDefault();
        setAuthMessage(null);
        if (!supabase) {
            setAuthMessage("Supabase nao configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
            return;
        }
        if (authMode === "signin") {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setAuthMessage(error.message);
                return;
            }
            setAuthMessage("Login realizado com sucesso.");
            return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setAuthMessage(error.message);
            return;
        }
        setAuthMessage("Cadastro enviado. Verifique seu email para confirmar a conta.");
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
        return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "kicker", children: "AutomacaoZap" }), _jsx("h1", { children: "Acesso ao painel" }), _jsx("p", { className: "description", children: "Entre para gerenciar empresas, integracoes e atendimento com IA." })] }), _jsxs("section", { className: "card auth-card", children: [_jsx("h2", { children: authMode === "signin" ? "Entrar" : "Criar conta" }), !isSupabaseConfigured && (_jsx("p", { className: "todo", children: "Modo fallback: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`." })), _jsxs("form", { className: "auth-form", onSubmit: onSubmitAuth, children: [_jsx("input", { type: "email", placeholder: "seu@email.com", value: email, onChange: (e) => setEmail(e.target.value), required: true }), _jsx("input", { type: "password", placeholder: "Senha", value: password, onChange: (e) => setPassword(e.target.value), required: true }), _jsx("button", { type: "submit", children: authMode === "signin" ? "Entrar" : "Cadastrar" })] }), _jsx("button", { className: "link-btn", onClick: () => setAuthMode(authMode === "signin" ? "signup" : "signin"), children: authMode === "signin" ? "Nao tem conta? Criar agora" : "Ja tem conta? Entrar" }), authMessage ? _jsx("p", { className: "todo", children: authMessage }) : null] })] }));
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "hero", children: [_jsx("p", { className: "kicker", children: "AutomacaoZap" }), _jsx("h1", { children: "SaaS de atendimento com IA no WhatsApp" }), _jsx("p", { className: "description", children: "Base inicial pronta para evoluir em blocos: multiempresa, integra\u00E7\u00F5es com fallback e deploy em Netlify." }), _jsxs("p", { className: "description", children: ["Sessao: ", _jsx("strong", { children: session.user.email })] }), _jsx("button", { className: "link-btn", onClick: logout, children: "Sair" })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "Empresa ativa" }), _jsx("p", { className: "status", children: memberships[0].companyName }), _jsxs("p", { className: "todo", children: ["Role: ", memberships[0].role] }), _jsx("p", { className: "todo", children: "TODO[TENANT-SCHEMA-01]: persistir companies e memberships no Supabase." })] }), _jsx("section", { className: "grid", children: cards.map((card) => (_jsxs("article", { className: "card", children: [_jsx("h2", { children: card.title }), _jsx("p", { className: "status", children: statusLabel(card.mode) }), _jsx("p", { className: "todo", children: card.todo })] }, card.title))) })] }));
}
