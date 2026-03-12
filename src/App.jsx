import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const REGIONS = ["East", "West", "South", "Midwest"];
const TEAMS = {
  East: [
    { seed: 1, name: "Duke" }, { seed: 16, name: "Mount St. Mary's" },
    { seed: 8, name: "Mississippi St." }, { seed: 9, name: "Baylor" },
    { seed: 5, name: "Oregon" }, { seed: 12, name: "Liberty" },
    { seed: 4, name: "Arizona" }, { seed: 13, name: "Akron" },
    { seed: 6, name: "BYU" }, { seed: 11, name: "VCU" },
    { seed: 3, name: "Wisconsin" }, { seed: 14, name: "Montana" },
    { seed: 7, name: "Saint Mary's" }, { seed: 10, name: "Vanderbilt" },
    { seed: 2, name: "Alabama" }, { seed: 15, name: "Robert Morris" },
  ],
  West: [
    { seed: 1, name: "Auburn" }, { seed: 16, name: "Alabama St." },
    { seed: 8, name: "Louisville" }, { seed: 9, name: "Creighton" },
    { seed: 5, name: "Michigan" }, { seed: 12, name: "UC San Diego" },
    { seed: 4, name: "Texas A&M" }, { seed: 13, name: "Yale" },
    { seed: 6, name: "Ole Miss" }, { seed: 11, name: "Drake" },
    { seed: 3, name: "Iowa St." }, { seed: 14, name: "Lipscomb" },
    { seed: 7, name: "Marquette" }, { seed: 10, name: "New Mexico" },
    { seed: 2, name: "Michigan St." }, { seed: 15, name: "Bryant" },
  ],
  South: [
    { seed: 1, name: "Florida" }, { seed: 16, name: "Norfolk St." },
    { seed: 8, name: "UConn" }, { seed: 9, name: "Oklahoma" },
    { seed: 5, name: "Memphis" }, { seed: 12, name: "Colorado St." },
    { seed: 4, name: "Maryland" }, { seed: 13, name: "Grand Canyon" },
    { seed: 6, name: "Missouri" }, { seed: 11, name: "Drake" },
    { seed: 3, name: "Texas Tech" }, { seed: 14, name: "UNCW" },
    { seed: 7, name: "Kansas" }, { seed: 10, name: "Arkansas" },
    { seed: 2, name: "St. John's" }, { seed: 15, name: "Omaha" },
  ],
  Midwest: [
    { seed: 1, name: "Houston" }, { seed: 16, name: "SIUE" },
    { seed: 8, name: "Gonzaga" }, { seed: 9, name: "Georgia" },
    { seed: 5, name: "Clemson" }, { seed: 12, name: "McNeese" },
    { seed: 4, name: "Purdue" }, { seed: 13, name: "High Point" },
    { seed: 6, name: "Illinois" }, { seed: 11, name: "Texas" },
    { seed: 3, name: "Kentucky" }, { seed: 14, name: "Troy" },
    { seed: 7, name: "UCLA" }, { seed: 10, name: "Utah St." },
    { seed: 2, name: "Tennessee" }, { seed: 15, name: "Wofford" },
  ],
};

// ── FLIP TO false ON SUNDAY AFTER UPDATING TEAMS ──
const BRACKET_PENDING = true;

const buildInitialBracket = () => {
  const bracket = {};
  REGIONS.forEach((region) => {
    bracket[region] = {
      rounds: [
        TEAMS[region].map((t) => ({ ...t, region })),
        Array(8).fill(null),
        Array(4).fill(null),
        Array(2).fill(null),
        Array(1).fill(null),
      ],
    };
  });
  bracket.semi1Winner = null;
  bracket.semi2Winner = null;
  bracket.champion = null;
  return bracket;
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --orange: #FF5722; --orange-dim: #cc4418; --cream: #FFF8F0; --ink: #1A1208; --mid: #8a7060; --surface: #ffffff; --border: #e8ddd0; --green: #2ECC71; --shadow: 0 2px 12px rgba(26,18,8,0.10); }
  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--ink); min-height: 100vh; }
  .landing { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; position: relative; overflow: hidden; }
  .landing::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 59px, var(--border) 59px, var(--border) 60px), repeating-linear-gradient(90deg, transparent, transparent 59px, var(--border) 59px, var(--border) 60px); opacity: 0.5; }
  .landing-inner { position: relative; z-index: 1; text-align: center; max-width: 560px; }
  .landing-eyebrow { font-weight: 600; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--orange); margin-bottom: 16px; }
  .landing-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(72px, 14vw, 120px); line-height: 0.9; color: var(--ink); margin-bottom: 8px; }
  .landing-title span { color: var(--orange); }
  .landing-sub { font-size: 15px; color: var(--mid); margin-bottom: 32px; line-height: 1.6; }
  .timeline { display: flex; flex-direction: column; gap: 10px; margin-bottom: 36px; text-align: left; background: white; border: 1.5px solid var(--border); border-radius: 6px; padding: 18px 22px; }
  .timeline-item { display: flex; align-items: center; gap: 12px; font-size: 13px; }
  .tl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tl-dot.now { background: var(--orange); box-shadow: 0 0 0 3px rgba(255,87,34,0.2); }
  .tl-dot.upcoming { background: var(--border); }
  .tl-date { font-weight: 600; color: var(--ink); min-width: 90px; }
  .tl-desc { color: var(--mid); }
  .tl-desc.now { color: var(--orange); font-weight: 600; }
  .google-btn { display: inline-flex; align-items: center; gap: 12px; background: var(--ink); color: white; border: none; padding: 16px 32px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; border-radius: 4px; cursor: pointer; transition: all 0.15s; }
  .google-btn:hover { background: var(--orange); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,87,34,0.35); }
  .google-icon { width: 20px; height: 20px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--orange); }
  .deadline-note { margin-top: 16px; font-size: 12px; color: var(--mid); }
  .app { min-height: 100vh; display: flex; flex-direction: column; }
  .topbar { background: var(--ink); color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; position: sticky; top: 0; z-index: 100; }
  .topbar-brand { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.05em; }
  .topbar-brand span { color: var(--orange); }
  .topbar-nav { display: flex; gap: 4px; }
  .nav-btn { background: transparent; border: none; color: rgba(255,255,255,0.55); font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 3px; cursor: pointer; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.03em; }
  .nav-btn:hover, .nav-btn.active { background: rgba(255,255,255,0.1); color: white; }
  .nav-btn.active { color: var(--orange); }
  .topbar-user { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.7); }
  .avatar { width: 32px; height: 32px; background: var(--orange); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white; }
  .signout-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); font-size: 11px; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
  .signout-btn:hover { border-color: rgba(255,255,255,0.5); color: white; }
  .pending-page { min-height: calc(100vh - 56px); display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
  .pending-inner { text-align: center; max-width: 460px; }
  .pending-badge { display: inline-block; background: var(--orange); color: white; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; padding: 5px 12px; border-radius: 2px; margin-bottom: 20px; }
  .pending-title { font-family: 'Bebas Neue', sans-serif; font-size: 52px; color: var(--ink); line-height: 1; margin-bottom: 12px; }
  .pending-sub { font-size: 14px; color: var(--mid); line-height: 1.7; margin-bottom: 32px; }
  .pending-timeline { text-align: left; background: white; border: 1.5px solid var(--border); border-radius: 6px; padding: 18px 22px; display: flex; flex-direction: column; gap: 10px; }
  .bracket-page { padding: 32px 16px 100px; overflow-x: auto; }
  .bracket-title { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: var(--ink); margin-bottom: 4px; }
  .bracket-meta { font-size: 13px; color: var(--mid); margin-bottom: 32px; }
  .picks-count { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--orange); }
  .bracket-layout { display: flex; gap: 0; min-width: 1100px; align-items: center; justify-content: center; }
  .region-block { flex: 1; }
  .region-label { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.08em; color: var(--orange); text-align: center; margin-bottom: 12px; }
  .rounds-row { display: flex; gap: 0; }
  .round-col { display: flex; flex-direction: column; justify-content: space-around; min-width: 110px; padding: 0 3px; }
  .matchup { display: flex; flex-direction: column; gap: 2px; margin: 4px 0; }
  .team-slot { display: flex; align-items: center; gap: 5px; padding: 5px 7px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 3px; cursor: pointer; transition: all 0.12s; min-height: 30px; font-size: 11px; font-weight: 500; color: var(--ink); user-select: none; overflow: hidden; }
  .team-slot:hover:not(.empty) { border-color: var(--orange); background: #fff5f0; }
  .team-slot.selected { background: var(--orange); border-color: var(--orange); color: white; }
  .team-slot.empty { background: #f5f0eb; border-color: #e0d8d0; cursor: default; }
  .seed-badge { font-size: 9px; font-weight: 700; color: var(--mid); min-width: 14px; }
  .team-slot.selected .seed-badge { color: rgba(255,255,255,0.7); }
  .team-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10.5px; }
  .final-four-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 200px; padding: 0 16px; gap: 4px; }
  .ff-section-label { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 0.12em; color: var(--mid); text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .ff-matchup { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
  .vs-divider { text-align: center; font-size: 9px; font-weight: 700; color: var(--mid); letter-spacing: 0.1em; margin: 2px 0; }
  .champion-slot { background: var(--ink); border: 2px solid var(--orange); border-radius: 4px; padding: 10px 14px; text-align: center; min-width: 150px; margin: 10px 0; }
  .champion-label { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin-bottom: 4px; }
  .champion-name { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: white; }
  .championship-label { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 0.12em; color: var(--orange); text-align: center; margin-bottom: 4px; }
  .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--ink); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 200; border-top: 2px solid var(--orange); }
  .save-bar-text { color: rgba(255,255,255,0.7); font-size: 13px; }
  .save-bar-text strong { color: white; }
  .save-btn { background: var(--orange); color: white; border: none; padding: 10px 28px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; border-radius: 3px; cursor: pointer; transition: all 0.15s; }
  .save-btn:hover { background: var(--orange-dim); }
  .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .saved-badge { background: var(--green); color: white; padding: 10px 20px; border-radius: 3px; font-size: 13px; font-weight: 600; }
  .leaderboard-page { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; }
  .lb-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: var(--ink); margin-bottom: 4px; }
  .lb-meta { font-size: 13px; color: var(--mid); margin-bottom: 32px; display: flex; align-items: center; gap: 8px; }
  .live-dot { width: 8px; height: 8px; background: var(--green); border-radius: 50%; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .lb-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 8px; transition: all 0.12s; }
  .lb-card:hover { border-color: var(--orange); box-shadow: var(--shadow); }
  .lb-card.me { border-color: var(--orange); background: #fff8f5; }
  .lb-row { display: flex; align-items: center; padding: 14px 18px; gap: 14px; }
  .lb-rank { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: var(--mid); min-width: 32px; text-align: center; }
  .lb-rank.top { color: var(--orange); }
  .lb-avatar { width: 38px; height: 38px; background: var(--ink); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0; }
  .lb-avatar.me-av { background: var(--orange); }
  .lb-info { flex: 1; }
  .lb-name { font-weight: 600; font-size: 14px; }
  .lb-detail { font-size: 12px; color: var(--mid); margin-top: 1px; }
  .lb-score { text-align: right; }
  .lb-pts { font-family: 'Bebas Neue', sans-serif; font-size: 28px; line-height: 1; }
  .lb-pts-label { font-size: 10px; color: var(--mid); text-transform: uppercase; letter-spacing: 0.08em; }
  .lb-bar-wrap { padding: 0 18px 14px; }
  .lb-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .lb-bar-fill { height: 100%; background: var(--orange); border-radius: 2px; transition: width 0.6s ease; }
  .lb-empty { text-align: center; padding: 60px 20px; color: var(--mid); font-size: 14px; }
  .toast { position: fixed; top: 72px; right: 20px; background: var(--ink); color: white; padding: 12px 20px; border-radius: 4px; font-size: 13px; font-weight: 500; border-left: 3px solid var(--orange); z-index: 999; animation: slideIn 0.2s ease; }
  @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  .loading { display: flex; align-items: center; justify-content: center; height: 100vh; font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: var(--orange); letter-spacing: 0.1em; }
`;

const getInitials = (name) => name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

const countPicks = (b) => {
  let count = 0;
  REGIONS.forEach((r) => { for (let ri = 1; ri < 5; ri++) { b[r]?.rounds[ri]?.forEach((t) => { if (t) count++; }); } });
  if (b.semi1Winner) count++;
  if (b.semi2Winner) count++;
  if (b.champion) count++;
  return count;
};

const TeamSlot = ({ team, selected, onClick, style }) => {
  if (!team) return <div className="team-slot empty" style={style}>—</div>;
  return (
    <div className={`team-slot${selected ? " selected" : ""}`} onClick={onClick} title={team.name} style={style}>
      <span className="seed-badge">{team.seed}</span>
      <span className="team-name">{team.name}</span>
    </div>
  );
};

const RegionBracket = ({ region, bracket, onPick, flipped }) => {
  const rounds = bracket[region].rounds;
  const buildMatchups = (rt) => { const m = []; for (let i = 0; i < rt.length; i += 2) m.push([rt[i], rt[i+1]]); return m; };
  return (
    <div className="region-block">
      <div className="region-label">{region}</div>
      <div className="rounds-row" style={{ flexDirection: flipped ? "row-reverse" : "row" }}>
        {rounds.slice(0, 4).map((roundTeams, ri) => {
          const matchups = buildMatchups(roundTeams);
          const spacing = Math.pow(2, ri) * 8;
          return (
            <div key={ri} className="round-col" style={{ minWidth: ri === 3 ? 120 : 110 }}>
              {matchups.map((pair, mi) => (
                <div key={mi} className="matchup" style={{ marginTop: mi === 0 ? spacing/2 : spacing, marginBottom: spacing/2 }}>
                  {pair.map((team, ti) => (
                    <TeamSlot key={ti} team={team} selected={rounds[ri+1]?.[mi]?.name === team?.name}
                      onClick={() => team && onPick(region, ri, mi, ti)} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TimelineItem = ({ date, desc, active }) => (
  <div className="timeline-item">
    <div className={`tl-dot ${active ? "now" : "upcoming"}`} />
    <span className="tl-date">{date}</span>
    <span className={`tl-desc${active ? " now" : ""}`}>{desc}</span>
  </div>
);

const Leaderboard = ({ currentUserId }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("brackets").select("user_id, user_name, user_email, score, picks").order("score", { ascending: false });
      setEntries(data || []); setLoading(false);
    };
    fetch();
    const ch = supabase.channel("lb").on("postgres_changes", { event: "*", schema: "public", table: "brackets" }, fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  const max = entries[0]?.score || 1;
  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="leaderboard-page">
      <div className="lb-title">Leaderboard</div>
      <div className="lb-meta"><span className="live-dot" /><span>Live · 2026 NCAA Tournament</span></div>
      {entries.length === 0 && <div className="lb-empty">No brackets yet. Check back after Selection Sunday! 🏀</div>}
      {entries.map((entry, i) => {
        const isMe = entry.user_id === currentUserId;
        return (
          <div key={entry.user_email} className={`lb-card${isMe ? " me" : ""}`}>
            <div className="lb-row">
              <div className={`lb-rank${i < 3 ? " top" : ""}`}>{i+1}</div>
              <div className={`lb-avatar${isMe ? " me-av" : ""}`}>{getInitials(entry.user_name)}</div>
              <div className="lb-info">
                <div className="lb-name">{entry.user_name}{isMe ? " (you)" : ""}</div>
                <div className="lb-detail">{entry.score} pts</div>
              </div>
              <div className="lb-score"><div className="lb-pts">{entry.score}</div><div className="lb-pts-label">pts</div></div>
            </div>
            <div className="lb-bar-wrap"><div className="lb-bar"><div className="lb-bar-fill" style={{ width: `${(entry.score/max)*100}%` }} /></div></div>
          </div>
        );
      })}
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("bracket");
  const [bracket, setBracket] = useState(buildInitialBracket());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [totalPicks, setTotalPicks] = useState(0);

  useEffect(() => {
    const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); if (session) loadBracket(session.user.id); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { setSession(session); if (session) loadBracket(session.user.id); });
    return () => subscription.unsubscribe();
  }, []);

  const loadBracket = async (uid) => {
    const { data } = await supabase.from("brackets").select("picks").eq("user_id", uid).single();
    if (data?.picks) { setBracket(data.picks); setTotalPicks(countPicks(data.picks)); setSaved(true); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const handleLogin = async () => { await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } }); };
  const handleSignOut = async () => { await supabase.auth.signOut(); setSession(null); setBracket(buildInitialBracket()); setSaved(false); setTotalPicks(0); };

  const handlePick = (region, round, matchupIdx, teamIdx) => {
    setBracket((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const team = next[region].rounds[round][matchupIdx * 2 + teamIdx];
      if (!team) return prev;
      next[region].rounds[round + 1][matchupIdx] = team;
      for (let r = round + 2; r < 5; r++) { next[region].rounds[r][Math.floor(matchupIdx / Math.pow(2, r - round - 1))] = null; }
      if (region === "East" || region === "West") { next.semi1Winner = null; next.champion = null; }
      if (region === "South" || region === "Midwest") { next.semi2Winner = null; next.champion = null; }
      setSaved(false);
      setTotalPicks(countPicks(next));
      return next;
    });
  };

  const pickSemi1 = (team) => {
    setBracket((p) => { const n = { ...p, semi1Winner: team, champion: null }; setSaved(false); setTotalPicks(countPicks(n)); return n; });
  };
  const pickSemi2 = (team) => {
    setBracket((p) => { const n = { ...p, semi2Winner: team, champion: null }; setSaved(false); setTotalPicks(countPicks(n)); return n; });
  };
  const pickChampion = (team) => {
    setBracket((p) => { const n = { ...p, champion: team }; setSaved(false); setTotalPicks(countPicks(n)); return n; });
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.from("brackets").upsert({
      user_id: session.user.id, user_email: session.user.email,
      user_name: session.user.user_metadata?.full_name || session.user.email,
      picks: bracket, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) { showToast("Error saving — try again"); return; }
    setSaved(true); showToast("Bracket saved! 🏀");
  };

  const eastWinner = bracket.East.rounds[4][0];
  const westWinner = bracket.West.rounds[4][0];
  const southWinner = bracket.South.rounds[4][0];
  const midwestWinner = bracket.Midwest.rounds[4][0];

  if (authLoading) return <div className="loading">BOL MADNESS</div>;

  // ── LOGGED OUT ──
  if (!session) {
    return (
      <div className="landing">
        <div className="landing-inner">
          <div className="landing-eyebrow">BOL Agency · 2026</div>
          <div className="landing-title">MARCH<br /><span>MADNESS</span></div>
          <div className="landing-sub">The field drops Sunday. Sign in now so you're ready to fill out your bracket the moment it's live.</div>
          <div className="timeline">
            <TimelineItem date="Sun Mar 15" desc="Selection Sunday — bracket revealed" active={true} />
            <TimelineItem date="Mon Mar 16" desc="Brackets open for picks" active={false} />
            <TimelineItem date="Tue Mar 17" desc="Brackets lock · 12:00 PM ET" active={false} />
            <TimelineItem date="Thu Mar 19" desc="First round tips off" active={false} />
          </div>
          <button className="google-btn" onClick={handleLogin}><span className="google-icon">G</span>Sign in with Google</button>
          <div className="deadline-note">BOL Google accounts only · Brackets lock Tuesday March 17 at noon</div>
        </div>
      </div>
    );
  }

  const userName = session.user.user_metadata?.full_name || session.user.email;

  // ── LOGGED IN + BRACKET PENDING ──
  if (BRACKET_PENDING) {
    return (
      <div className="app">
        {toast && <div className="toast">{toast}</div>}
        <div className="topbar">
          <div className="topbar-brand">BOL <span>MADNESS</span></div>
          <div className="topbar-nav">
            <button className={`nav-btn${tab === "bracket" ? " active" : ""}`} onClick={() => setTab("bracket")}>My Bracket</button>
            <button className={`nav-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Leaderboard</button>
          </div>
          <div className="topbar-user">
            <span>{userName}</span>
            <div className="avatar">{getInitials(userName)}</div>
            <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
        {tab === "bracket" && (
          <div className="pending-page">
            <div className="pending-inner">
              <div className="pending-badge">⏳ Coming Sunday</div>
              <div className="pending-title">Bracket Pending</div>
              <div className="pending-sub">You're signed in and ready to go. The 2026 field gets revealed on Selection Sunday — check back Sunday evening to fill out your picks.</div>
              <div className="pending-timeline">
                <TimelineItem date="Sun Mar 15" desc="Selection Sunday — bracket revealed" active={true} />
                <TimelineItem date="Mon Mar 16" desc="Brackets open for picks" active={false} />
                <TimelineItem date="Tue Mar 17" desc="Brackets lock · 12:00 PM ET" active={false} />
                <TimelineItem date="Thu Mar 19" desc="First round tips off" active={false} />
              </div>
            </div>
          </div>
        )}
        {tab === "leaderboard" && <Leaderboard currentUserId={session.user.id} />}
      </div>
    );
  }

  // ── LOGGED IN + BRACKET OPEN ──
  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      <div className="topbar">
        <div className="topbar-brand">BOL <span>MADNESS</span></div>
        <div className="topbar-nav">
          <button className={`nav-btn${tab === "bracket" ? " active" : ""}`} onClick={() => setTab("bracket")}>My Bracket</button>
          <button className={`nav-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Leaderboard</button>
        </div>
        <div className="topbar-user">
          <span>{userName}</span>
          <div className="avatar">{getInitials(userName)}</div>
          <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>
      {tab === "bracket" && (
        <>
          <div className="bracket-page">
            <div className="bracket-title">Your Bracket</div>
            <div className="bracket-meta">Click a team to advance them · <span className="picks-count">{totalPicks}</span> picks made</div>
            <div className="bracket-layout">
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <RegionBracket region="East" bracket={bracket} onPick={handlePick} flipped={false} />
                <RegionBracket region="West" bracket={bracket} onPick={handlePick} flipped={false} />
              </div>
              <div className="final-four-center">
                <div className="ff-section-label">Semifinal 1</div>
                <div className="ff-matchup">
                  <TeamSlot team={eastWinner} selected={bracket.semi1Winner?.name === eastWinner?.name}
                    style={{ minWidth: 150 }} onClick={() => eastWinner && pickSemi1(eastWinner)} />
                  <div className="vs-divider">VS</div>
                  <TeamSlot team={westWinner} selected={bracket.semi1Winner?.name === westWinner?.name}
                    style={{ minWidth: 150 }} onClick={() => westWinner && pickSemi1(westWinner)} />
                </div>
                <div className="championship-label">🏆 Championship</div>
                <div className="ff-matchup">
                  <TeamSlot team={bracket.semi1Winner} selected={bracket.champion?.name === bracket.semi1Winner?.name}
                    style={{ minWidth: 150 }} onClick={() => bracket.semi1Winner && pickChampion(bracket.semi1Winner)} />
                  <div className="vs-divider">VS</div>
                  <TeamSlot team={bracket.semi2Winner} selected={bracket.champion?.name === bracket.semi2Winner?.name}
                    style={{ minWidth: 150 }} onClick={() => bracket.semi2Winner && pickChampion(bracket.semi2Winner)} />
                </div>
                <div className="champion-slot">
                  <div className="champion-label">🏆 Champion</div>
                  <div className="champion-name">{bracket.champion?.name || "—"}</div>
                </div>
                <div className="ff-section-label">Semifinal 2</div>
                <div className="ff-matchup">
                  <TeamSlot team={southWinner} selected={bracket.semi2Winner?.name === southWinner?.name}
                    style={{ minWidth: 150 }} onClick={() => southWinner && pickSemi2(southWinner)} />
                  <div className="vs-divider">VS</div>
                  <TeamSlot team={midwestWinner} selected={bracket.semi2Winner?.name === midwestWinner?.name}
                    style={{ minWidth: 150 }} onClick={() => midwestWinner && pickSemi2(midwestWinner)} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <RegionBracket region="South" bracket={bracket} onPick={handlePick} flipped={true} />
                <RegionBracket region="Midwest" bracket={bracket} onPick={handlePick} flipped={true} />
              </div>
            </div>
          </div>
          <div className="save-bar">
            <div className="save-bar-text"><strong>{totalPicks} picks</strong> made · {63 - totalPicks} remaining</div>
            {saved ? <div className="saved-badge">✓ Bracket Saved</div> : (
              <button className="save-btn" onClick={handleSave} disabled={totalPicks === 0 || saving}>
                {saving ? "Saving..." : "Save Bracket"}
              </button>
            )}
          </div>
        </>
      )}
      {tab === "leaderboard" && <Leaderboard currentUserId={session.user.id} />}
    </div>
  );
}
