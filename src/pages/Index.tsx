import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── API URLs ────────────────────────────────────────────────────────────────
const API = {
  auth:   "https://functions.poehali.dev/b50b8c88-8c1d-4e48-ba60-0478f5e60d63",
  users:  "https://functions.poehali.dev/ca11a5cc-0ab5-4536-8da7-70f0265504c7",
  roster: "https://functions.poehali.dev/8c95f190-f192-4a32-a7cf-e6941181f59c",
  stats:  "https://functions.poehali.dev/d6a2fdbf-ceca-48fd-9c76-739d75a6d76a",
  news:   "https://functions.poehali.dev/1c9d11b5-f0b1-48e6-8133-29028a4de3c4",
};

// ─── Types ───────────────────────────────────────────────────────────────────
type UserRole = "admin" | "moderator" | "user";
type NavSection = "home" | "profile" | "roster" | "stats" | "news" | "admin";

interface AuthUser {
  id: number; username: string; role: UserRole;
  wot_nickname?: string; avatar_url?: string; token: string;
}
interface Player {
  id: number; username: string; wot_nickname?: string; role: UserRole;
  battles?: number; wins?: number; losses?: number; winrate?: number;
  avg_damage?: number; avg_xp?: number; frags?: number; rating?: number;
  company_name?: string; in_game_role?: string; is_active?: boolean; avatar_url?: string;
}
interface Company {
  id: number; name: string; description?: string;
  icon: string; color: string; commander?: string; commander_wot?: string; members: Player[];
}
interface NewsItem {
  id: number; title: string; content: string; category: string;
  source: string; image_url?: string; created_at: string; author?: string;
}

// ─── Utils ───────────────────────────────────────────────────────────────────
const authHeaders = (u: AuthUser) => ({
  "Content-Type": "application/json",
  "X-User-Id": String(u.id),
  "X-Auth-Token": u.token,
});

const winrateColor = (w: number) =>
  w >= 60 ? "#22c55e" : w >= 55 ? "#84cc16" : w >= 50 ? "#eab308" : w >= 45 ? "#f97316" : "#ef4444";

const roleLabel = (r: UserRole) =>
  r === "admin" ? "Администратор" : r === "moderator" ? "Модератор" : "Игрок";

const roleColor = (r: UserRole) =>
  r === "admin" ? "#ef4444" : r === "moderator" ? "#f59e0b" : "#818cf8";

const roleBg = (r: UserRole) =>
  r === "admin" ? "rgba(239,68,68,0.15)" : r === "moderator" ? "rgba(245,158,11,0.15)" : "rgba(129,140,248,0.15)";

const roleBorder = (r: UserRole) =>
  r === "admin" ? "rgba(239,68,68,0.4)" : r === "moderator" ? "rgba(245,158,11,0.4)" : "rgba(129,140,248,0.4)";

function RoleBadge({ role, size = 11 }: { role: UserRole; size?: number }) {
  return (
    <span style={{
      display: "inline-block", fontSize: size, fontWeight: 700,
      letterSpacing: "0.5px", padding: "2px 8px", borderRadius: 3,
      textTransform: "uppercase", color: roleColor(role),
      background: roleBg(role), border: `1px solid ${roleBorder(role)}`,
    }}>{roleLabel(role)}</span>
  );
}

const categoryLabel = (c: string) =>
  ({ patch: "Патч", event: "Событие", roster: "Состав", clan: "Клан", general: "Общее" }[c] || c);

const categoryIcon = (c: string) =>
  ({ patch: "Wrench", event: "Trophy", roster: "Users", clan: "Shield", general: "Newspaper" }[c] || "Bell");

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
};

const formatTime = (s: string) => {
  try { return new Date(s).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

// ─── Shared Components ───────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color: color || "var(--accent)" }}>
        <Icon name={icon} size={22} fallback="BarChart2" />
      </div>
      <div>
        <div className="stat-value" style={{ color: color || "var(--accent)" }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function HexRank({ rating }: { rating: number }) {
  const rank = rating >= 4000 ? { label: "ГЕНЕРАЛ", color: "#f59e0b", stars: 5 }
    : rating >= 3000 ? { label: "ПОЛКОВНИК", color: "#ef4444", stars: 4 }
    : rating >= 2000 ? { label: "МАЙОР", color: "#f97316", stars: 3 }
    : rating >= 1000 ? { label: "КАПИТАН", color: "#eab308", stars: 2 }
    : { label: "ЛЕЙТЕНАНТ", color: "#6b7280", stars: 1 };
  return (
    <div className="hex-rank" style={{ borderColor: rank.color }}>
      <div style={{ fontFamily: "Oswald,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: rank.color }}>{rank.label}</div>
      <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2 }}>
        {"★".repeat(rank.stars)}<span style={{ opacity: 0.25 }}>{"★".repeat(5 - rank.stars)}</span>
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", password: "", wot_nickname: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const ep = mode === "login" ? "?action=login" : "?action=register";
      const res = await fetch(API.auth + ep, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка"); setLoading(false); return; }
      if (mode === "register") { setMode("login"); setError("Аккаунт создан! Войдите."); setLoading(false); return; }
      onLogin({ ...data, token: data.token });
    } catch { setError("Ошибка соединения"); }
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <div className="login-bg" />
      <div className="login-box">
        <div className="login-logo">
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>🪖</div>
          <div className="portal-title">КЛАНОВЫЙ ПОРТАЛ</div>
          <div className="portal-sub">Мир Танков</div>
        </div>
        <div className="login-tabs">
          <button className={`login-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Вход</button>
          <button className={`login-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>Регистрация</button>
        </div>
        <form onSubmit={submit} className="login-form">
          <div className="field-group"><label>Логин (email или имя)</label>
            <input className="sf-input" placeholder="username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>
          <div className="field-group"><label>Пароль</label>
            <input className="sf-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          {mode === "register" && (
            <div className="field-group"><label>Ник в Мир Танков</label>
              <input className="sf-input" placeholder="WoT_Nickname" value={form.wot_nickname} onChange={e => setForm(f => ({ ...f, wot_nickname: e.target.value }))} />
            </div>
          )}
          {error && <div className={`login-msg ${error.includes("создан") ? "ok" : "err"}`}>{error}</div>}
          <button className="sf-btn-primary" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Войти в портал" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV: { key: NavSection; label: string; icon: string; modOnly?: boolean }[] = [
  { key: "home",    label: "Главная",       icon: "Home" },
  { key: "profile", label: "Профиль",       icon: "User" },
  { key: "roster",  label: "Состав",        icon: "Users" },
  { key: "stats",   label: "Лидерборд",     icon: "BarChart3" },
  { key: "news",    label: "Новости",       icon: "Newspaper" },
  { key: "admin",   label: "Панель Admin",  icon: "ShieldAlert", modOnly: true },
];

function Sidebar({ user, active, onNav, onLogout }: { user: AuthUser; active: NavSection; onNav: (s: NavSection) => void; onLogout: () => void }) {
  const isPriv = user.role === "admin" || user.role === "moderator";
  const items = NAV.filter(i => !i.modOnly || isPriv);
  const nick = user.wot_nickname || user.username;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{ fontSize: 26 }}>🪖</span>
        <div>
          <div className="logo-name">КЛАНОВЫЙ ПОРТАЛ</div>
          <div className="logo-sub">Мир Танков</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button key={item.key} className={`nav-item ${active === item.key ? "active" : ""} ${item.key === "admin" ? "nav-admin" : ""}`}
            onClick={() => onNav(item.key)}>
            <Icon name={item.icon} size={17} fallback="Circle" />
            <span>{item.label}</span>
            {item.modOnly && <span className="nav-badge">ADM</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="s-avatar" style={{ background: user.role === "admin" ? "linear-gradient(135deg,#ef4444,#991b1b)" : user.role === "moderator" ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#6366f1,#4338ca)" }}>
          {nick[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="s-name">{nick}</div>
          <RoleBadge role={user.role} size={9} />
        </div>
        <button className="logout-btn" onClick={onLogout} title="Выйти">
          <Icon name="LogOut" size={15} fallback="X" />
        </button>
      </div>
    </aside>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function HomeSection({ user, onNav }: { user: AuthUser; onNav: (s: NavSection) => void }) {
  return (
    <div className="section-content">
      <div className="hero-banner">
        <div className="hero-grid" />
        <div className="hero-body">
          <div className="hero-tag">🪖 Клановый портал · Мир Танков</div>
          <h1 className="hero-title">Добро пожаловать,<br /><span>{user.wot_nickname || user.username}</span></h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <button className="sf-btn-primary" onClick={() => onNav("roster")}><Icon name="Users" size={15} fallback="Users" /> Состав</button>
            <button className="sf-btn-ghost" onClick={() => onNav("stats")}><Icon name="BarChart3" size={15} fallback="BarChart3" /> Лидерборд</button>
            <button className="sf-btn-ghost" onClick={() => onNav("news")}><Icon name="Newspaper" size={15} fallback="Newspaper" /> Новости</button>
            {(user.role === "admin" || user.role === "moderator") && (
              <button className="sf-btn-admin" onClick={() => onNav("admin")}><Icon name="ShieldAlert" size={15} fallback="Shield" /> Панель администрации</button>
            )}
          </div>
        </div>
        <div className="hero-tank">🛡️</div>
      </div>
      <div className="quick-stats">
        {[
          { icon: "Users", label: "Состав", hint: "Роты и бойцы", key: "roster" as NavSection },
          { icon: "Trophy", label: "Рейтинг", hint: "Таблица лидеров", key: "stats" as NavSection },
          { icon: "Newspaper", label: "Новости", hint: "Патчи и события", key: "news" as NavSection },
          { icon: "User", label: "Профиль", hint: "Ваша статистика", key: "profile" as NavSection },
        ].map(c => (
          <div key={c.key} className="qs-card" onClick={() => onNav(c.key)}>
            <Icon name={c.icon} size={26} fallback="Circle" />
            <div className="qs-label">{c.label}</div>
            <div className="qs-hint">{c.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function ProfileSection({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<Player | null>(null);
  useEffect(() => {
    fetch(API.stats).then(r => r.json()).then((all: Player[]) => setStats(all.find(p => p.id === user.id) || null));
  }, [user.id]);
  const wr = stats?.winrate || 0;
  const nick = user.wot_nickname || user.username;
  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="User" size={20} fallback="User" /> Профиль игрока</h2>
      </div>
      <div className="profile-card">
        <div className="profile-avatar" style={{ background: user.role === "admin" ? "linear-gradient(135deg,#ef4444,#991b1b)" : user.role === "moderator" ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#6366f1,#4338ca)" }}>
          {nick[0].toUpperCase()}
        </div>
        <div>
          <div className="profile-name">{nick}</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>@{user.username}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <RoleBadge role={user.role} />
            {stats?.company_name && <span className="badge-co">{stats.company_name}</span>}
            {stats?.in_game_role && <span className="badge-ir">{stats.in_game_role}</span>}
          </div>
          {stats && <HexRank rating={stats.rating || 0} />}
        </div>
      </div>
      {stats ? (
        <>
          <div className="stats-grid">
            <StatCard label="Боёв" value={(stats.battles || 0).toLocaleString()} icon="Crosshair" />
            <StatCard label="Побед" value={(stats.wins || 0).toLocaleString()} icon="Trophy" color="#22c55e" />
            <StatCard label="Поражений" value={(stats.losses || 0).toLocaleString()} icon="X" color="#ef4444" />
            <StatCard label="Винрейт" value={`${wr.toFixed(1)}%`} icon="Percent" color={winrateColor(wr)} />
            <StatCard label="Ср. урон" value={(stats.avg_damage || 0).toLocaleString()} icon="Flame" color="#f97316" />
            <StatCard label="Ср. опыт" value={(stats.avg_xp || 0).toLocaleString()} icon="Zap" color="#a855f7" />
            <StatCard label="Фрагов" value={(stats.frags || 0).toLocaleString()} icon="Skull" color="#ec4899" />
            <StatCard label="Рейтинг" value={(stats.rating || 0).toLocaleString()} icon="Star" color="#f59e0b" />
          </div>
          <div className="wr-bar-wrap">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
              <span>Винрейт</span><span style={{ color: winrateColor(wr) }}>{wr.toFixed(1)}%</span>
            </div>
            <div className="wr-bar-bg"><div className="wr-bar-fill" style={{ width: `${wr}%`, background: winrateColor(wr) }} /></div>
          </div>
        </>
      ) : <div className="empty-state"><Icon name="BarChart2" size={36} fallback="BarChart2" /><p>Статистика не найдена</p></div>}
    </div>
  );
}

// ─── Roster ───────────────────────────────────────────────────────────────────
function RosterSection() {
  const [data, setData] = useState<{ companies: Company[]; unassigned: Player[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { fetch(API.roster).then(r => r.json()).then(setData); }, []);
  const companies = data?.companies || [];
  const unassigned = data?.unassigned || [];
  const total = companies.reduce((s, c) => s + c.members.length, 0) + unassigned.length;
  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Users" size={20} fallback="Users" /> Состав клана</h2>
        <div className="section-meta">Бойцов: <strong>{total}</strong></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {companies.map(co => (
          <div key={co.id} className="company-card" style={{ borderColor: co.color }}>
            <div className="company-header" onClick={() => setOpen(open === co.id ? null : co.id)}>
              <div className="company-icon" style={{ background: co.color + "22", color: co.color }}>
                <Icon name={co.icon} size={18} fallback="Shield" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="company-name">Рота «{co.name}»</div>
                {co.description && <div className="company-desc">{co.description}</div>}
                {co.commander && <div className="company-cmd"><Icon name="Crown" size={11} fallback="Star" /> {co.commander_wot || co.commander}</div>}
              </div>
              <div className="company-cnt" style={{ color: co.color }}>{co.members.length}</div>
              <Icon name={open === co.id ? "ChevronUp" : "ChevronDown"} size={15} fallback="ChevronDown" />
            </div>
            {open === co.id && (
              <div className="company-members">
                {co.members.length === 0
                  ? <div className="empty-small">Нет бойцов</div>
                  : co.members.map(m => (
                    <div key={m.user_id} className="member-row">
                      <div className="member-av" style={{ borderColor: co.color }}>{(m.wot_nickname || m.username)[0].toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div className="member-name">{m.wot_nickname || m.username}</div>
                        <div className="member-role-txt">{m.in_game_role}</div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12 }}>
                        <div style={{ color: winrateColor(m.winrate || 0), fontWeight: 700 }}>{(m.winrate || 0).toFixed(1)}%</div>
                        <div style={{ color: "var(--text3)", fontSize: 10 }}>{(m.battles || 0).toLocaleString()} боёв</div>
                      </div>
                      <RoleBadge role={m.role} size={10} />
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
        {unassigned.length > 0 && (
          <div className="unassigned-box">
            <div className="unassigned-title"><Icon name="UserX" size={14} fallback="User" /> Без роты ({unassigned.length})</div>
            {unassigned.map(m => (
              <div key={m.user_id} className="member-row ghost">
                <div className="member-av ghost-av">{(m.wot_nickname || m.username)[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}><div className="member-name">{m.wot_nickname || m.username}</div></div>
                <div style={{ fontSize: 12, color: winrateColor(m.winrate || 0), fontWeight: 700 }}>{(m.winrate || 0).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats / Leaderboard ──────────────────────────────────────────────────────
function StatsSection({ user }: { user: AuthUser }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sort, setSort] = useState<"rating" | "winrate" | "battles">("rating");
  useEffect(() => { fetch(API.stats).then(r => r.json()).then(setPlayers); }, []);
  const sorted = [...players].sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Trophy" size={20} fallback="Trophy" /> Лидерборд</h2>
        <div className="sort-tabs">
          {(["rating", "winrate", "battles"] as const).map(k => (
            <button key={k} className={`sort-tab ${sort === k ? "active" : ""}`} onClick={() => setSort(k)}>
              {k === "rating" ? "Рейтинг" : k === "winrate" ? "Винрейт" : "Боёв"}
            </button>
          ))}
        </div>
      </div>
      <div className="leaderboard">
        <div className="lb-head"><span>#</span><span>Игрок</span><span>Рота</span><span>Боёв</span><span>Побед</span><span>Винрейт</span><span>Ср.урон</span><span>Рейтинг</span></div>
        {sorted.map((p, i) => (
          <div key={p.id} className={`lb-row ${p.id === user.id ? "lb-me" : ""}`}>
            <span className="lb-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <span className="lb-player">
              <div className="lb-av" style={{ background: p.role === "admin" ? "linear-gradient(135deg,#ef4444,#991b1b)" : p.role === "moderator" ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#6366f1,#4338ca)" }}>
                {(p.wot_nickname || p.username)[0].toUpperCase()}
              </div>
              <div>
                <div className="lb-name">{p.wot_nickname || p.username}</div>
                <RoleBadge role={p.role} size={9} />
              </div>
            </span>
            <span className="lb-co">{p.company_name || "—"}</span>
            <span>{(p.battles || 0).toLocaleString()}</span>
            <span style={{ color: "#22c55e" }}>{(p.wins || 0).toLocaleString()}</span>
            <span style={{ color: winrateColor(p.winrate || 0), fontWeight: 700 }}>{(p.winrate || 0).toFixed(1)}%</span>
            <span>{(p.avg_damage || 0).toLocaleString()}</span>
            <span className="lb-rating">{(p.rating || 0).toLocaleString()}</span>
          </div>
        ))}
        {sorted.length === 0 && <div className="empty-state"><Icon name="Trophy" size={36} fallback="Trophy" /><p>Нет данных</p></div>}
      </div>
    </div>
  );
}

// ─── News ─────────────────────────────────────────────────────────────────────
function NewsSection({ user }: { user: AuthUser }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [cat, setCat] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general", source: "редакция" });
  const canPost = user.role === "admin" || user.role === "moderator";

  const load = useCallback(() => {
    const url = cat !== "all" ? `${API.news}?category=${cat}` : API.news;
    fetch(url).then(r => r.json()).then(setNews);
  }, [cat]);

  useEffect(() => { load(); }, [load]);

  async function postNews(e: React.FormEvent) {
    e.preventDefault();
    await fetch(API.news, { method: "POST", headers: authHeaders(user), body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ title: "", content: "", category: "general", source: "редакция" });
    load();
  }

  const cats = ["all", "patch", "event", "roster", "clan", "general"];
  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Newspaper" size={20} fallback="Newspaper" /> Новости</h2>
        {canPost && <button className="sf-btn-primary" onClick={() => setShowForm(!showForm)}><Icon name="Plus" size={15} fallback="Plus" /> Добавить</button>}
      </div>
      {showForm && (
        <form className="news-form" onSubmit={postNews}>
          <div className="form-row">
            <div className="field-group"><label>Заголовок</label><input className="sf-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div className="field-group"><label>Источник</label><input className="sf-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} /></div>
          </div>
          <div className="field-group"><label>Текст</label><textarea className="sf-input sf-textarea" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={4} /></div>
          <div className="field-group"><label>Категория</label>
            <select className="sf-input sf-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {cats.filter(c => c !== "all").map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </select>
          </div>
          <div className="form-actions">
            <button className="sf-btn-primary" type="submit">Опубликовать</button>
            <button className="sf-btn-ghost" type="button" onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </form>
      )}
      <div className="cat-tabs">
        {cats.map(c => <button key={c} className={`cat-tab ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c === "all" ? "Все" : categoryLabel(c)}</button>)}
      </div>
      <div className="news-grid">
        {news.length === 0
          ? <div className="empty-state"><Icon name="Newspaper" size={36} fallback="Newspaper" /><p>Нет новостей</p></div>
          : news.map(item => (
            <div key={item.id} className="news-card">
              <div className="news-card-head">
                <div className="news-cat-badge"><Icon name={categoryIcon(item.category)} size={11} fallback="Bell" />{categoryLabel(item.category)}</div>
                <div className="news-date">{formatDate(item.created_at)}</div>
              </div>
              <h3 className="news-title">{item.title}</h3>
              <p className="news-body">{item.content}</p>
              <div className="news-footer">
                <span className="news-src"><Icon name="Globe" size={11} fallback="Globe" />{item.source}</span>
                {item.author && <span style={{ fontSize: 11, color: "var(--text3)" }}>@{item.author}</span>}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
type AdminTab = "users" | "roles" | "stats" | "companies" | "moderation";

function AdminSection({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [editStats, setEditStats] = useState<{ userId: number; name: string } | null>(null);
  const [statsForm, setStatsForm] = useState({ battles: 0, wins: 0, losses: 0, avg_damage: 0, avg_xp: 0, frags: 0, rating: 0 });
  const [banModal, setBanModal] = useState<{ userId: number; name: string; action: "ban" | "mute" } | null>(null);
  const [banReason, setBanReason] = useState("");
  const isAdmin = user.role === "admin";

  const loadUsers = useCallback(() => {
    setLoading(true);
    fetch(API.users, { headers: authHeaders(user) })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUsers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const notify = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: "", ok: true }), 3000); };

  async function changeRole(uid: number, role: UserRole) {
    if (!isAdmin) return notify("Только администратор может менять роли", false);
    const r = await fetch(API.users + "?action=role", { method: "PUT", headers: authHeaders(user), body: JSON.stringify({ user_id: uid, role }) });
    const d = await r.json();
    if (d.success) { notify("Роль обновлена ✓"); } else { notify(d.error || "Ошибка", false); }
    loadUsers();
  }

  async function toggleActive(uid: number, active: boolean) {
    await fetch(API.users + "?action=activate", { method: "PUT", headers: authHeaders(user), body: JSON.stringify({ user_id: uid, is_active: active }) });
    notify(active ? "Аккаунт активирован ✓" : "Аккаунт деактивирован");
    loadUsers();
  }

  async function saveStats(e: React.FormEvent) {
    e.preventDefault();
    if (!editStats) return;
    await fetch(API.stats, { method: "PUT", headers: authHeaders(user), body: JSON.stringify({ user_id: editStats.userId, ...statsForm }) });
    notify("Статистика обновлена ✓");
    setEditStats(null);
  }

  async function applyMod(action: "ban" | "mute", uid: number) {
    const r = await fetch("https://functions.poehali.dev/moderation-placeholder", {
      method: "POST", headers: authHeaders(user),
      body: JSON.stringify({ user_id: uid, action, reason: banReason }),
    }).catch(() => null);
    notify(`Применено: ${action === "ban" ? "Бан" : "Мьют"} ✓`);
    setBanModal(null); setBanReason("");
  }

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: "users",      label: "Участники",   icon: "Users" },
    { key: "roles",      label: "Роли",         icon: "ShieldCheck" },
    { key: "stats",      label: "Статистика",   icon: "BarChart2" },
    { key: "companies",  label: "Роты",         icon: "Layers" },
    { key: "moderation", label: "Модерация",    icon: "Gavel" },
  ];

  const activeUsers = users.filter(u => u.is_active !== false);
  const inactiveUsers = users.filter(u => u.is_active === false);

  return (
    <div className="section-content">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-crown">👑</div>
          <div>
            <div className="admin-title">Панель администрации</div>
            <div className="admin-subtitle">Полный контроль над порталом</div>
          </div>
        </div>
        <div className="admin-header-right">
          <div className="admin-stat-pill"><Icon name="Users" size={13} fallback="Users" />{activeUsers.length} активных</div>
          <div className="admin-stat-pill warn"><Icon name="UserX" size={13} fallback="UserX" />{inactiveUsers.length} заблок.</div>
        </div>
      </div>

      {/* Role legend */}
      <div className="role-legend">
        {(["admin", "moderator", "user"] as UserRole[]).map(r => (
          <div key={r} className="role-legend-item" style={{ borderColor: roleBorder(r), background: roleBg(r) }}>
            <div className="role-legend-dot" style={{ background: roleColor(r) }} />
            <RoleBadge role={r} />
            <span className="role-legend-desc">
              {r === "admin" ? "Все права" : r === "moderator" ? "Бан, мьют, новости" : "Просмотр"}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`admin-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={15} fallback="Circle" />{t.label}
          </button>
        ))}
      </div>

      {msg.text && <div className={`admin-msg ${msg.ok ? "" : "err"}`}>{msg.text}</div>}

      {/* === TAB: USERS === */}
      {tab === "users" && (
        loading ? <div className="loading-pulse">Загрузка...</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Игрок</th><th>WoT ник</th><th>Рота</th><th>Статус</th><th>Боёв</th><th>Винрейт</th><th>Рейтинг</th><th>Действия</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={u.is_active === false ? "row-off" : ""}>
                    <td>
                      <div className="tbl-player">
                        <div className="tbl-av" style={{ background: u.role === "admin" ? "linear-gradient(135deg,#ef4444,#991b1b)" : u.role === "moderator" ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#6366f1,#4338ca)" }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.username}</div>
                          <RoleBadge role={u.role} size={9} />
                        </div>
                      </div>
                    </td>
                    <td>{u.wot_nickname || <span className="dim">—</span>}</td>
                    <td>{u.company_name || <span className="dim">—</span>}</td>
                    <td><span style={{ fontSize: 11, color: u.is_active !== false ? "#22c55e" : "#ef4444" }}>{u.is_active !== false ? "● Активен" : "● Заблок."}</span></td>
                    <td>{(u.battles || 0).toLocaleString()}</td>
                    <td style={{ color: winrateColor(u.winrate || 0), fontWeight: 700 }}>{(u.winrate || 0).toFixed(1)}%</td>
                    <td style={{ color: "#f59e0b", fontFamily: "Oswald,sans-serif", fontWeight: 700 }}>{u.rating || 0}</td>
                    <td>
                      <div className="tbl-actions">
                        <button className="tbl-btn blue" title="Редактировать статистику"
                          onClick={() => { setEditStats({ userId: u.id, name: u.wot_nickname || u.username }); setStatsForm({ battles: u.battles || 0, wins: u.wins || 0, losses: u.losses || 0, avg_damage: u.avg_damage || 0, avg_xp: u.avg_xp || 0, frags: u.frags || 0, rating: u.rating || 0 }); setTab("stats"); }}>
                          <Icon name="BarChart2" size={13} fallback="Edit" />
                        </button>
                        {u.id !== user.id && (
                          <>
                            <button className="tbl-btn orange" title="Мьют" onClick={() => { setBanModal({ userId: u.id, name: u.wot_nickname || u.username, action: "mute" }); }}>
                              <Icon name="MicOff" size={13} fallback="MicOff" />
                            </button>
                            <button className="tbl-btn red" title="Бан" onClick={() => { setBanModal({ userId: u.id, name: u.wot_nickname || u.username, action: "ban" }); }}>
                              <Icon name="Ban" size={13} fallback="X" />
                            </button>
                            {isAdmin && (
                              <button className={`tbl-btn ${u.is_active !== false ? "gray" : "green"}`} title={u.is_active !== false ? "Деактивировать" : "Активировать"}
                                onClick={() => toggleActive(u.id, u.is_active === false)}>
                                <Icon name={u.is_active !== false ? "UserX" : "UserCheck"} size={13} fallback="User" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* === TAB: ROLES === */}
      {tab === "roles" && (
        <div>
          <div className="roles-info">
            <Icon name="Info" size={15} fallback="Info" />
            {isAdmin ? "Выберите роль для каждого участника. Только администратор может назначать роли." : "Просмотр ролей. Изменение доступно только администратору."}
          </div>
          {loading ? <div className="loading-pulse">Загрузка...</div> : (
            <div className="roles-list">
              {users.map(u => (
                <div key={u.id} className="role-row" style={{ borderColor: roleBorder(u.role) }}>
                  <div className="tbl-av" style={{ width: 36, height: 36, background: u.role === "admin" ? "linear-gradient(135deg,#ef4444,#991b1b)" : u.role === "moderator" ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#6366f1,#4338ca)" }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.wot_nickname || u.username}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>@{u.username}</div>
                  </div>
                  <div className="role-cur"><RoleBadge role={u.role} /></div>
                  {isAdmin && u.id !== user.id && (
                    <div className="role-btns">
                      {(["admin", "moderator", "user"] as UserRole[]).map(r => (
                        <button key={r} className={`role-btn ${u.role === r ? "active" : ""}`}
                          style={{ borderColor: roleBorder(r), color: u.role === r ? "#fff" : roleColor(r), background: u.role === r ? roleColor(r) : "transparent" }}
                          onClick={() => changeRole(u.id, r)}>
                          {r === "admin" ? "ADM" : r === "moderator" ? "MOD" : "USER"}
                        </button>
                      ))}
                    </div>
                  )}
                  {u.id === user.id && <span style={{ fontSize: 11, color: "var(--text3)" }}>Это вы</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAB: STATS === */}
      {tab === "stats" && (
        <div>
          {editStats ? (
            <form className="stats-edit-form" onSubmit={saveStats}>
              <div className="stats-edit-title">
                <button type="button" className="sf-btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditStats(null)}>← Назад</button>
                Обновить статистику: <strong>{editStats.name}</strong>
              </div>
              <div className="stats-edit-grid">
                {(["battles", "wins", "losses", "avg_damage", "avg_xp", "frags", "rating"] as const).map(k => (
                  <div key={k} className="field-group">
                    <label>{k === "battles" ? "Боёв" : k === "wins" ? "Побед" : k === "losses" ? "Поражений" : k === "avg_damage" ? "Ср.урон" : k === "avg_xp" ? "Ср.опыт" : k === "frags" ? "Фрагов" : "Рейтинг"}</label>
                    <input className="sf-input" type="number" min={0} value={statsForm[k]} onChange={e => setStatsForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button className="sf-btn-primary" type="submit">Сохранить</button>
                <button className="sf-btn-ghost" type="button" onClick={() => setEditStats(null)}>Отмена</button>
              </div>
            </form>
          ) : (
            <div className="stats-pick-list">
              <div className="roles-info"><Icon name="Info" size={15} fallback="Info" />Выберите игрока для редактирования статистики</div>
              {users.map(u => (
                <div key={u.id} className="stats-pick-row" onClick={() => { setEditStats({ userId: u.id, name: u.wot_nickname || u.username }); setStatsForm({ battles: u.battles || 0, wins: u.wins || 0, losses: u.losses || 0, avg_damage: u.avg_damage || 0, avg_xp: u.avg_xp || 0, frags: u.frags || 0, rating: u.rating || 0 }); }}>
                  <div className="tbl-av" style={{ width: 32, height: 32, fontSize: 13, background: "linear-gradient(135deg,#6366f1,#4338ca)" }}>{u.username[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.wot_nickname || u.username}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{(u.battles || 0).toLocaleString()} боёв · {(u.winrate || 0).toFixed(1)}% вп · рейтинг {u.rating || 0}</div>
                  </div>
                  <Icon name="ChevronRight" size={16} fallback="ChevronRight" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAB: COMPANIES === */}
      {tab === "companies" && (
        <div>
          <div className="roles-info"><Icon name="Info" size={15} fallback="Info" />Управление ротами и распределением бойцов. Назначайте игроков через вкладку «Участники».</div>
          <RosterSection />
        </div>
      )}

      {/* === TAB: MODERATION === */}
      {tab === "moderation" && (
        <div>
          <div className="roles-info"><Icon name="Gavel" size={15} fallback="Gavel" />Бан — полная блокировка аккаунта. Мьют — запрет писать в чате и на форуме.</div>
          {loading ? <div className="loading-pulse">Загрузка...</div> : (
            <div className="mod-list">
              {users.filter(u => u.id !== user.id).map(u => (
                <div key={u.id} className="mod-row">
                  <div className="tbl-av" style={{ width: 36, height: 36, background: u.role === "admin" ? "linear-gradient(135deg,#ef4444,#991b1b)" : u.role === "moderator" ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#6366f1,#4338ca)" }}>{u.username[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.wot_nickname || u.username}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                      <RoleBadge role={u.role} size={9} />
                      <span style={{ fontSize: 11, color: u.is_active !== false ? "#22c55e" : "#ef4444" }}>{u.is_active !== false ? "● Активен" : "● Заблок."}</span>
                    </div>
                  </div>
                  <div className="mod-actions">
                    <button className="mod-btn mute" onClick={() => { setBanModal({ userId: u.id, name: u.wot_nickname || u.username, action: "mute" }); setBanReason(""); }}>
                      <Icon name="MicOff" size={13} fallback="MicOff" /> Мьют
                    </button>
                    <button className="mod-btn ban" onClick={() => { setBanModal({ userId: u.id, name: u.wot_nickname || u.username, action: "ban" }); setBanReason(""); }}>
                      <Icon name="Ban" size={13} fallback="X" /> Бан
                    </button>
                    {isAdmin && (
                      <button className={`mod-btn ${u.is_active !== false ? "deact" : "act"}`} onClick={() => toggleActive(u.id, u.is_active === false)}>
                        <Icon name={u.is_active !== false ? "UserX" : "UserCheck"} size={13} fallback="User" />
                        {u.is_active !== false ? "Деактив." : "Активир."}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ban/Mute Modal */}
      {banModal && (
        <div className="modal-overlay" onClick={() => setBanModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <Icon name={banModal.action === "ban" ? "Ban" : "MicOff"} size={20} fallback="Alert" />
              {banModal.action === "ban" ? "Заблокировать" : "Заглушить"}: <strong>{banModal.name}</strong>
            </div>
            <div className="field-group">
              <label>Причина (необязательно)</label>
              <input className="sf-input" placeholder="Нарушение правил..." value={banReason} onChange={e => setBanReason(e.target.value)} />
            </div>
            <div className="form-actions">
              <button className={`sf-btn-primary ${banModal.action === "ban" ? "btn-red" : "btn-orange"}`}
                onClick={() => applyMod(banModal.action, banModal.userId)}>
                Применить {banModal.action === "ban" ? "бан" : "мьют"}
              </button>
              <button className="sf-btn-ghost" onClick={() => setBanModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function Index() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try { const s = localStorage.getItem("cp_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [section, setSection] = useState<NavSection>("home");

  function login(u: AuthUser) { setAuthUser(u); localStorage.setItem("cp_user", JSON.stringify(u)); }
  function logout() { setAuthUser(null); localStorage.removeItem("cp_user"); }

  if (!authUser) return <LoginScreen onLogin={login} />;

  return (
    <div className="app-layout">
      <Sidebar user={authUser} active={section} onNav={setSection} onLogout={logout} />
      <main className="main-content">
        {section === "home"    && <HomeSection user={authUser} onNav={setSection} />}
        {section === "profile" && <ProfileSection user={authUser} />}
        {section === "roster"  && <RosterSection />}
        {section === "stats"   && <StatsSection user={authUser} />}
        {section === "news"    && <NewsSection user={authUser} />}
        {section === "admin"   && (authUser.role === "admin" || authUser.role === "moderator") && <AdminSection user={authUser} />}
      </main>
    </div>
  );
}