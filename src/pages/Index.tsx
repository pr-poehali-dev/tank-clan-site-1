import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── API URLs ────────────────────────────────────────────────────────────────
const API = {
  auth: "https://functions.poehali.dev/b50b8c88-8c1d-4e48-ba60-0478f5e60d63",
  users: "https://functions.poehali.dev/ca11a5cc-0ab5-4536-8da7-70f0265504c7",
  roster: "https://functions.poehali.dev/8c95f190-f192-4a32-a7cf-e6941181f59c",
  stats: "https://functions.poehali.dev/d6a2fdbf-ceca-48fd-9c76-739d75a6d76a",
  news: "https://functions.poehali.dev/1c9d11b5-f0b1-48e6-8133-29028a4de3c4",
};

// ─── Types ───────────────────────────────────────────────────────────────────
type UserRole = "admin" | "moderator" | "user";
type NavSection = "home" | "profile" | "roster" | "stats" | "news" | "admin";

interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  wot_nickname?: string;
  avatar_url?: string;
  token: string;
}

interface Player {
  id: number;
  username: string;
  wot_nickname?: string;
  role: UserRole;
  battles?: number;
  wins?: number;
  losses?: number;
  winrate?: number;
  avg_damage?: number;
  avg_xp?: number;
  frags?: number;
  rating?: number;
  company_name?: string;
  in_game_role?: string;
  is_active?: boolean;
  avatar_url?: string;
}

interface Company {
  id: number;
  name: string;
  description?: string;
  icon: string;
  color: string;
  commander?: string;
  commander_wot?: string;
  members: Player[];
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  category: string;
  source: string;
  image_url?: string;
  created_at: string;
  author?: string;
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function authHeaders(user: AuthUser) {
  return {
    "Content-Type": "application/json",
    "X-User-Id": String(user.id),
    "X-Auth-Token": user.token,
  };
}

function winrateColor(wr: number) {
  if (wr >= 60) return "#22c55e";
  if (wr >= 55) return "#84cc16";
  if (wr >= 50) return "#eab308";
  if (wr >= 45) return "#f97316";
  return "#ef4444";
}

function roleLabel(role: UserRole) {
  return role === "admin" ? "Администратор" : role === "moderator" ? "Модератор" : "Игрок";
}

function roleBadgeClass(role: UserRole) {
  return role === "admin"
    ? "badge-admin"
    : role === "moderator"
    ? "badge-mod"
    : "badge-user";
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    patch: "Патч", event: "Событие", roster: "Состав",
    clan: "Клан", general: "Общее",
  };
  return map[cat] || cat;
}

function categoryIcon(cat: string) {
  const map: Record<string, string> = {
    patch: "Wrench", event: "Trophy", roster: "Users",
    clan: "Shield", general: "Newspaper",
  };
  return map[cat] || "Bell";
}

function formatDate(str: string) {
  try {
    return new Date(str).toLocaleDateString("ru-RU", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return str; }
}

// ─── Components ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ color: color || "var(--accent-orange)" }}>
        <Icon name={icon} size={22} fallback="BarChart2" />
      </div>
      <div>
        <div className="stat-value" style={{ color: color }}>{value}</div>
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
      <div className="hex-rank-label" style={{ color: rank.color }}>{rank.label}</div>
      <div className="hex-stars">{"★".repeat(rank.stars)}<span style={{ opacity: 0.3 }}>{"★".repeat(5 - rank.stars)}</span></div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", password: "", wot_nickname: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "?action=login" : "?action=register";
      const res = await fetch(API.auth + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка"); setLoading(false); return; }
      if (mode === "register") {
        setMode("login");
        setError("Аккаунт создан! Войдите.");
        setLoading(false);
        return;
      }
      onLogin({ ...data, token: data.token });
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <div className="login-bg-grid" />
      <div className="login-box">
        <div className="login-logo">
          <div className="logo-tank">🪖</div>
          <div className="login-title">STEEL FORCE</div>
          <div className="login-subtitle">Клановый портал</div>
        </div>
        <div className="login-tabs">
          <button className={`login-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Вход</button>
          <button className={`login-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>Регистрация</button>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="field-group">
            <label>Логин</label>
            <input className="sf-input" placeholder="username" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>
          <div className="field-group">
            <label>Пароль</label>
            <input className="sf-input" type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          {mode === "register" && (
            <div className="field-group">
              <label>Ник в Мир Танков</label>
              <input className="sf-input" placeholder="WoT_Nickname" value={form.wot_nickname}
                onChange={e => setForm(f => ({ ...f, wot_nickname: e.target.value }))} />
            </div>
          )}
          {error && <div className={`login-error ${error.includes("создан") ? "login-success" : ""}`}>{error}</div>}
          <button className="sf-btn-primary" type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Войти в портал" : "Создать аккаунт"}
          </button>
        </form>
        <div className="login-hint">
          <span>Тест: </span><code>admin</code> / <code>admin123</code>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: NavSection; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: "home", label: "Главная", icon: "Home" },
  { key: "profile", label: "Профиль", icon: "User" },
  { key: "roster", label: "Состав клана", icon: "Users" },
  { key: "stats", label: "Лидерборд", icon: "BarChart3" },
  { key: "news", label: "Новости", icon: "Newspaper" },
  { key: "admin", label: "Управление", icon: "Settings", adminOnly: true },
];

function Sidebar({ user, active, onNav, onLogout }: {
  user: AuthUser; active: NavSection; onNav: (s: NavSection) => void; onLogout: () => void;
}) {
  const canAdmin = user.role === "admin" || user.role === "moderator";
  const items = NAV_ITEMS.filter(i => !i.adminOnly || canAdmin);
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">🪖</span>
        <div>
          <div className="logo-name">STEEL FORCE</div>
          <div className="logo-sub">Клановый портал</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button key={item.key}
            className={`nav-item ${active === item.key ? "active" : ""}`}
            onClick={() => onNav(item.key)}>
            <Icon name={item.icon} size={18} fallback="Circle" />
            <span>{item.label}</span>
            {item.adminOnly && <span className="nav-badge">ADM</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="sidebar-avatar">{(user.wot_nickname || user.username)[0].toUpperCase()}</div>
        <div className="sidebar-userinfo">
          <div className="sidebar-username">{user.wot_nickname || user.username}</div>
          <div className={`badge ${roleBadgeClass(user.role)}`}>{roleLabel(user.role)}</div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Выйти">
          <Icon name="LogOut" size={16} fallback="X" />
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
        <div className="hero-bg-pattern" />
        <div className="hero-content">
          <div className="hero-tag">🪖 Клановый портал</div>
          <h1 className="hero-title">STEEL FORCE</h1>
          <p className="hero-desc">Добро пожаловать, <strong>{user.wot_nickname || user.username}</strong>. Командный портал клана под вашим управлением.</p>
          <div className="hero-actions">
            <button className="sf-btn-primary" onClick={() => onNav("roster")}>
              <Icon name="Users" size={16} fallback="Users" /> Состав клана
            </button>
            <button className="sf-btn-ghost" onClick={() => onNav("stats")}>
              <Icon name="BarChart3" size={16} fallback="BarChart3" /> Лидерборд
            </button>
          </div>
        </div>
        <div className="hero-tank">🛡️</div>
      </div>

      <div className="quick-stats">
        <div className="quick-stat-card" onClick={() => onNav("roster")}>
          <Icon name="Users" size={28} fallback="Users" />
          <div className="qs-label">Состав</div>
          <div className="qs-hint">Роты и бойцы</div>
        </div>
        <div className="quick-stat-card" onClick={() => onNav("stats")}>
          <Icon name="Trophy" size={28} fallback="Trophy" />
          <div className="qs-label">Рейтинг</div>
          <div className="qs-hint">Таблица лидеров</div>
        </div>
        <div className="quick-stat-card" onClick={() => onNav("news")}>
          <Icon name="Newspaper" size={28} fallback="Newspaper" />
          <div className="qs-label">Новости</div>
          <div className="qs-hint">Патчи и события</div>
        </div>
        <div className="quick-stat-card" onClick={() => onNav("profile")}>
          <Icon name="User" size={28} fallback="User" />
          <div className="qs-label">Профиль</div>
          <div className="qs-hint">Ваша статистика</div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function ProfileSection({ user }: { user: AuthUser }) {
  const [stats, setStats] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API.stats)
      .then(r => r.json())
      .then((all: Player[]) => {
        const me = all.find(p => p.id === user.id);
        setStats(me || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user.id]);

  const wr = stats?.winrate || 0;
  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="User" size={22} fallback="User" /> Профиль игрока</h2>
      </div>
      <div className="profile-card">
        <div className="profile-avatar-big">{(user.wot_nickname || user.username)[0].toUpperCase()}</div>
        <div className="profile-info">
          <div className="profile-name">{user.wot_nickname || user.username}</div>
          <div className="profile-login">@{user.username}</div>
          <div className="profile-badges">
            <span className={`badge ${roleBadgeClass(user.role)}`}>{roleLabel(user.role)}</span>
            {stats?.company_name && <span className="badge badge-company">{stats.company_name}</span>}
            {stats?.in_game_role && <span className="badge badge-role">{stats.in_game_role}</span>}
          </div>
          {stats && <HexRank rating={stats.rating || 0} />}
        </div>
      </div>

      {loading ? (
        <div className="loading-pulse">Загрузка статистики...</div>
      ) : stats ? (
        <>
          <div className="stats-grid">
            <StatCard label="Боёв" value={stats.battles?.toLocaleString() || 0} icon="Crosshair" />
            <StatCard label="Побед" value={stats.wins?.toLocaleString() || 0} icon="Trophy" color="#22c55e" />
            <StatCard label="Поражений" value={stats.losses?.toLocaleString() || 0} icon="X" color="#ef4444" />
            <StatCard label="Винрейт" value={`${wr.toFixed(1)}%`} icon="Percent" color={winrateColor(wr)} />
            <StatCard label="Ср. урон" value={stats.avg_damage?.toLocaleString() || 0} icon="Flame" color="#f97316" />
            <StatCard label="Ср. опыт" value={stats.avg_xp?.toLocaleString() || 0} icon="Zap" color="#a855f7" />
            <StatCard label="Фрагов" value={stats.frags?.toLocaleString() || 0} icon="Skull" color="#ec4899" />
            <StatCard label="Рейтинг" value={stats.rating?.toLocaleString() || 0} icon="Star" color="#f59e0b" />
          </div>
          <div className="winrate-bar-wrap">
            <div className="winrate-bar-label">
              <span>Побед</span>
              <span style={{ color: winrateColor(wr) }}>{wr.toFixed(1)}%</span>
            </div>
            <div className="winrate-bar-bg">
              <div className="winrate-bar-fill" style={{ width: `${wr}%`, background: winrateColor(wr) }} />
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Icon name="BarChart2" size={40} fallback="BarChart2" />
          <p>Статистика не найдена</p>
        </div>
      )}
    </div>
  );
}

// ─── Roster ───────────────────────────────────────────────────────────────────
function RosterSection({ user }: { user: AuthUser }) {
  const [data, setData] = useState<{ companies: Company[]; unassigned: Player[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<number | null>(null);

  useEffect(() => {
    fetch(API.roster)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-pulse">Загрузка состава...</div>;

  const companies = data?.companies || [];
  const unassigned = data?.unassigned || [];
  const totalMembers = companies.reduce((s, c) => s + c.members.length, 0) + unassigned.length;

  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Users" size={22} fallback="Users" /> Состав клана</h2>
        <div className="section-meta">Всего бойцов: <strong>{totalMembers}</strong></div>
      </div>

      <div className="company-grid">
        {companies.map(co => (
          <div key={co.id} className={`company-card ${activeCompany === co.id ? "expanded" : ""}`}
            style={{ borderColor: co.color }}>
            <div className="company-header" onClick={() => setActiveCompany(activeCompany === co.id ? null : co.id)}>
              <div className="company-icon" style={{ background: co.color + "22", color: co.color }}>
                <Icon name={co.icon} size={20} fallback="Shield" />
              </div>
              <div>
                <div className="company-name">Рота «{co.name}»</div>
                <div className="company-desc">{co.description}</div>
                {co.commander && (
                  <div className="company-commander">
                    <Icon name="Crown" size={12} fallback="Star" /> Командир: {co.commander_wot || co.commander}
                  </div>
                )}
              </div>
              <div className="company-count" style={{ color: co.color }}>{co.members.length}</div>
              <Icon name={activeCompany === co.id ? "ChevronUp" : "ChevronDown"} size={16} fallback="ChevronDown" />
            </div>
            {activeCompany === co.id && (
              <div className="company-members">
                {co.members.length === 0 ? (
                  <div className="empty-small">Нет бойцов</div>
                ) : (
                  co.members.map(m => (
                    <div key={m.user_id} className="member-row">
                      <div className="member-avatar" style={{ borderColor: co.color }}>
                        {(m.wot_nickname || m.username)[0].toUpperCase()}
                      </div>
                      <div className="member-info">
                        <div className="member-name">{m.wot_nickname || m.username}</div>
                        <div className="member-role">{m.in_game_role}</div>
                      </div>
                      <div className="member-stats">
                        <span style={{ color: winrateColor(m.winrate || 0) }}>{(m.winrate || 0).toFixed(1)}%</span>
                        <span className="member-battles">{(m.battles || 0).toLocaleString()} боёв</span>
                      </div>
                      <span className={`badge ${roleBadgeClass(m.role)}`}>{roleLabel(m.role)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className="unassigned-section">
          <h3 className="unassigned-title"><Icon name="UserX" size={16} fallback="User" /> Не распределены ({unassigned.length})</h3>
          <div className="unassigned-list">
            {unassigned.map(m => (
              <div key={m.user_id} className="member-row ghost">
                <div className="member-avatar ghost-avatar">{(m.wot_nickname || m.username)[0].toUpperCase()}</div>
                <div className="member-info">
                  <div className="member-name">{m.wot_nickname || m.username}</div>
                  <div className="member-role">Без роты</div>
                </div>
                <div className="member-stats">
                  <span style={{ color: winrateColor(m.winrate || 0) }}>{(m.winrate || 0).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function StatsSection({ user }: { user: AuthUser }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"rating" | "winrate" | "battles">("rating");

  useEffect(() => {
    fetch(API.stats)
      .then(r => r.json())
      .then(d => { setPlayers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...players].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Trophy" size={22} fallback="Trophy" /> Лидерборд</h2>
        <div className="sort-tabs">
          {(["rating", "winrate", "battles"] as const).map(k => (
            <button key={k} className={`sort-tab ${sortBy === k ? "active" : ""}`} onClick={() => setSortBy(k)}>
              {k === "rating" ? "Рейтинг" : k === "winrate" ? "Винрейт" : "Боёв"}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div className="loading-pulse">Загрузка...</div> : (
        <div className="leaderboard">
          <div className="lb-header">
            <span>#</span><span>Игрок</span><span>Рота</span><span>Боёв</span>
            <span>Побед</span><span>Винрейт</span><span>Ср. урон</span><span>Рейтинг</span>
          </div>
          {sorted.map((p, i) => (
            <div key={p.id} className={`lb-row ${p.id === user.id ? "lb-me" : ""} ${i < 3 ? "lb-top" : ""}`}>
              <span className={`lb-rank rank-${i + 1}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <span className="lb-player">
                <div className="lb-avatar">{(p.wot_nickname || p.username)[0].toUpperCase()}</div>
                <div>
                  <div className="lb-name">{p.wot_nickname || p.username}</div>
                  <div className={`badge ${roleBadgeClass(p.role)}`} style={{ fontSize: "10px" }}>{roleLabel(p.role)}</div>
                </div>
              </span>
              <span className="lb-company">{p.company_name || "—"}</span>
              <span>{(p.battles || 0).toLocaleString()}</span>
              <span style={{ color: "#22c55e" }}>{(p.wins || 0).toLocaleString()}</span>
              <span style={{ color: winrateColor(p.winrate || 0), fontWeight: 700 }}>
                {(p.winrate || 0).toFixed(1)}%
              </span>
              <span>{(p.avg_damage || 0).toLocaleString()}</span>
              <span className="lb-rating">{(p.rating || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── News ─────────────────────────────────────────────────────────────────────
function NewsSection({ user }: { user: AuthUser }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general", source: "редакция" });
  const [saving, setSaving] = useState(false);
  const canPost = user.role === "admin" || user.role === "moderator";

  const load = useCallback(() => {
    const url = catFilter !== "all" ? `${API.news}?category=${catFilter}` : API.news;
    fetch(url).then(r => r.json()).then(d => { setNews(d); setLoading(false); }).catch(() => setLoading(false));
  }, [catFilter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function postNews(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(API.news, {
      method: "POST",
      headers: authHeaders(user),
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ title: "", content: "", category: "general", source: "редакция" });
    load();
  }

  const categories = ["all", "patch", "event", "roster", "clan", "general"];

  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Newspaper" size={22} fallback="Newspaper" /> Новости</h2>
        {canPost && (
          <button className="sf-btn-primary" onClick={() => setShowForm(!showForm)}>
            <Icon name="Plus" size={16} fallback="Plus" /> Добавить новость
          </button>
        )}
      </div>

      {showForm && (
        <form className="news-form" onSubmit={postNews}>
          <div className="form-row">
            <div className="field-group">
              <label>Заголовок</label>
              <input className="sf-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="field-group">
              <label>Источник</label>
              <input className="sf-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
            </div>
          </div>
          <div className="field-group">
            <label>Текст новости</label>
            <textarea className="sf-input sf-textarea" value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required rows={4} />
          </div>
          <div className="field-group">
            <label>Категория</label>
            <select className="sf-input sf-select" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {categories.filter(c => c !== "all").map(c => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="sf-btn-primary" type="submit" disabled={saving}>{saving ? "Сохранение..." : "Опубликовать"}</button>
            <button className="sf-btn-ghost" type="button" onClick={() => setShowForm(false)}>Отмена</button>
          </div>
        </form>
      )}

      <div className="cat-tabs">
        {categories.map(c => (
          <button key={c} className={`cat-tab ${catFilter === c ? "active" : ""}`} onClick={() => setCatFilter(c)}>
            {c === "all" ? "Все" : categoryLabel(c)}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-pulse">Загрузка новостей...</div> : (
        <div className="news-grid">
          {news.length === 0 ? (
            <div className="empty-state"><Icon name="Newspaper" size={40} fallback="Newspaper" /><p>Новостей нет</p></div>
          ) : news.map(item => (
            <div key={item.id} className="news-card">
              <div className="news-card-header">
                <div className="news-category-badge">
                  <Icon name={categoryIcon(item.category)} size={12} fallback="Bell" />
                  {categoryLabel(item.category)}
                </div>
                <div className="news-date">{formatDate(item.created_at)}</div>
              </div>
              <h3 className="news-title">{item.title}</h3>
              <p className="news-content">{item.content}</p>
              <div className="news-footer">
                <span className="news-source">
                  <Icon name="Globe" size={12} fallback="Globe" /> {item.source}
                </span>
                {item.author && <span className="news-author">@{item.author}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminSection({ user }: { user: AuthUser }) {
  const [users, setUsers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editStats, setEditStats] = useState<{ userId: number; username: string } | null>(null);
  const [statsForm, setStatsForm] = useState({ battles: 0, wins: 0, losses: 0, avg_damage: 0, avg_xp: 0, frags: 0, rating: 0 });
  const isAdmin = user.role === "admin";

  const loadUsers = useCallback(() => {
    fetch(API.users, { headers: authHeaders(user) })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUsers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function changeRole(uid: number, role: UserRole) {
    const res = await fetch(API.users + "?action=role", {
      method: "PUT",
      headers: authHeaders(user),
      body: JSON.stringify({ user_id: uid, role }),
    });
    const d = await res.json();
    if (d.success) { setMsg(`Роль обновлена`); loadUsers(); }
    else setMsg(d.error || "Ошибка");
    setTimeout(() => setMsg(""), 3000);
  }

  async function toggleActive(uid: number, active: boolean) {
    await fetch(API.users + "?action=activate", {
      method: "PUT",
      headers: authHeaders(user),
      body: JSON.stringify({ user_id: uid, is_active: active }),
    });
    loadUsers();
  }

  async function saveStats(e: React.FormEvent) {
    e.preventDefault();
    if (!editStats) return;
    await fetch(API.stats, {
      method: "PUT",
      headers: authHeaders(user),
      body: JSON.stringify({ user_id: editStats.userId, ...statsForm }),
    });
    setMsg("Статистика обновлена");
    setEditStats(null);
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="section-content">
      <div className="section-header">
        <h2 className="section-title"><Icon name="Settings" size={22} fallback="Settings" /> Управление порталом</h2>
      </div>

      <div className="admin-badges">
        <div className="admin-badge-item">
          <span className="badge badge-admin">ADMIN</span>
          <span>Полный доступ: все права, роли, статистика</span>
        </div>
        <div className="admin-badge-item">
          <span className="badge badge-mod">MOD</span>
          <span>Модератор: состав, статистика, новости</span>
        </div>
        <div className="admin-badge-item">
          <span className="badge badge-user">ИГРОК</span>
          <span>Базовый доступ: профиль, просмотр</span>
        </div>
      </div>

      {msg && <div className="admin-msg">{msg}</div>}

      {editStats && (
        <div className="modal-overlay" onClick={() => setEditStats(null)}>
          <form className="modal-box" onClick={e => e.stopPropagation()} onSubmit={saveStats}>
            <h3>Обновить статистику: {editStats.username}</h3>
            <div className="stats-edit-grid">
              {(["battles", "wins", "losses", "avg_damage", "avg_xp", "frags", "rating"] as const).map(k => (
                <div key={k} className="field-group">
                  <label>{k === "battles" ? "Боёв" : k === "wins" ? "Побед" : k === "losses" ? "Поражений"
                    : k === "avg_damage" ? "Ср.урон" : k === "avg_xp" ? "Ср.опыт" : k === "frags" ? "Фрагов" : "Рейтинг"}</label>
                  <input className="sf-input" type="number" min={0}
                    value={statsForm[k]}
                    onChange={e => setStatsForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="sf-btn-primary" type="submit">Сохранить</button>
              <button className="sf-btn-ghost" type="button" onClick={() => setEditStats(null)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="loading-pulse">Загрузка...</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Игрок</th><th>WoT ник</th><th>Рота</th><th>Должность</th>
                <th>Боёв</th><th>Винрейт</th><th>Рейтинг</th><th>Роль</th><th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={!u.is_active ? "row-inactive" : ""}>
                  <td>
                    <div className="table-player">
                      <div className="table-avatar">{(u.username)[0].toUpperCase()}</div>
                      <span>{u.username}</span>
                    </div>
                  </td>
                  <td>{u.wot_nickname || "—"}</td>
                  <td>{u.company_name || <span className="dim">—</span>}</td>
                  <td>{u.in_game_role || <span className="dim">—</span>}</td>
                  <td>{(u.battles || 0).toLocaleString()}</td>
                  <td style={{ color: winrateColor(u.winrate || 0) }}>{(u.winrate || 0).toFixed(1)}%</td>
                  <td>{u.rating || 0}</td>
                  <td>
                    {isAdmin ? (
                      <select className="role-select"
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value as UserRole)}
                        disabled={u.id === user.id}>
                        <option value="admin">Админ</option>
                        <option value="moderator">Модератор</option>
                        <option value="user">Игрок</option>
                      </select>
                    ) : (
                      <span className={`badge ${roleBadgeClass(u.role)}`}>{roleLabel(u.role)}</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="tbl-btn" title="Обновить статистику"
                        onClick={() => { setEditStats({ userId: u.id, username: u.wot_nickname || u.username }); setStatsForm({ battles: u.battles || 0, wins: u.wins || 0, losses: u.losses || 0, avg_damage: u.avg_damage || 0, avg_xp: u.avg_xp || 0, frags: u.frags || 0, rating: u.rating || 0 }); }}>
                        <Icon name="BarChart2" size={14} fallback="Edit" />
                      </button>
                      {isAdmin && u.id !== user.id && (
                        <button className={`tbl-btn ${u.is_active ? "tbl-btn-danger" : "tbl-btn-success"}`}
                          onClick={() => toggleActive(u.id, !u.is_active)}
                          title={u.is_active ? "Деактивировать" : "Активировать"}>
                          <Icon name={u.is_active ? "UserX" : "UserCheck"} size={14} fallback="User" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Index() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const s = localStorage.getItem("sf_user");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [section, setSection] = useState<NavSection>("home");

  function handleLogin(u: AuthUser) {
    setAuthUser(u);
    localStorage.setItem("sf_user", JSON.stringify(u));
  }

  function handleLogout() {
    setAuthUser(null);
    localStorage.removeItem("sf_user");
  }

  if (!authUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="app-layout">
      <Sidebar user={authUser} active={section} onNav={setSection} onLogout={handleLogout} />
      <main className="main-content">
        {section === "home" && <HomeSection user={authUser} onNav={setSection} />}
        {section === "profile" && <ProfileSection user={authUser} />}
        {section === "roster" && <RosterSection user={authUser} />}
        {section === "stats" && <StatsSection user={authUser} />}
        {section === "news" && <NewsSection user={authUser} />}
        {section === "admin" && (authUser.role === "admin" || authUser.role === "moderator") && (
          <AdminSection user={authUser} />
        )}
      </main>
    </div>
  );
}