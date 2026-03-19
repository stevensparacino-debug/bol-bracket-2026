import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const REGIONS = ["East", "West", "South", "Midwest"];

const TEAMS = {
  East: [
    { seed: 1,  name: "Duke" },           { seed: 16, name: "Siena" },
    { seed: 8,  name: "Ohio State" },     { seed: 9,  name: "TCU" },
    { seed: 5,  name: "St. John's" },     { seed: 12, name: "N. Iowa" },
    { seed: 4,  name: "Kansas" },         { seed: 13, name: "Cal Baptist" },
    { seed: 6,  name: "Louisville" },     { seed: 11, name: "South Florida" },
    { seed: 3,  name: "Michigan St." },   { seed: 14, name: "N. Dakota St." },
    { seed: 7,  name: "UCLA" },           { seed: 10, name: "UCF" },
    { seed: 2,  name: "UConn" },          { seed: 15, name: "Furman" },
  ],
  West: [
    { seed: 1,  name: "Arizona" },        { seed: 16, name: "LIU" },
    { seed: 8,  name: "Villanova" },      { seed: 9,  name: "Utah State" },
    { seed: 5,  name: "Wisconsin" },      { seed: 12, name: "High Point" },
    { seed: 4,  name: "Arkansas" },       { seed: 13, name: "Hawai'i" },
    { seed: 6,  name: "BYU" },            { seed: 11, name: "TX/NC State" },
    { seed: 3,  name: "Gonzaga" },        { seed: 14, name: "Kennesaw St." },
    { seed: 7,  name: "Miami FL" },       { seed: 10, name: "Missouri" },
    { seed: 2,  name: "Purdue" },         { seed: 15, name: "Queens" },
  ],
  South: [
    { seed: 1,  name: "Florida" },        { seed: 16, name: "PVA&M/Lehigh" },
    { seed: 8,  name: "Clemson" },        { seed: 9,  name: "Iowa" },
    { seed: 5,  name: "Vanderbilt" },     { seed: 12, name: "McNeese" },
    { seed: 4,  name: "Nebraska" },       { seed: 13, name: "Troy" },
    { seed: 6,  name: "N. Carolina" },    { seed: 11, name: "VCU" },
    { seed: 3,  name: "Illinois" },       { seed: 14, name: "Penn" },
    { seed: 7,  name: "St. Mary's" },     { seed: 10, name: "Texas A&M" },
    { seed: 2,  name: "Houston" },        { seed: 15, name: "Idaho" },
  ],
  Midwest: [
    { seed: 1,  name: "Michigan" },       { seed: 16, name: "UMBC/Howard" },
    { seed: 8,  name: "Georgia" },        { seed: 9,  name: "Saint Louis" },
    { seed: 5,  name: "Texas Tech" },     { seed: 12, name: "Akron" },
    { seed: 4,  name: "Alabama" },        { seed: 13, name: "Hofstra" },
    { seed: 6,  name: "Tennessee" },      { seed: 11, name: "MiamiOH/SMU" },
    { seed: 3,  name: "Virginia" },       { seed: 14, name: "Wright State" },
    { seed: 7,  name: "Kentucky" },       { seed: 10, name: "Santa Clara" },
    { seed: 2,  name: "Iowa State" },     { seed: 15, name: "Tennessee St." },
  ],
};

const ADMIN_EMAIL = "steven.sparacino@bol-agency.com";
const BRACKET_PENDING = false;

// ESPN round detection based on number of teams remaining
// ESPN uses a "groups=100" scoreboard — we detect round by game count
// Round 1 (R64) = 32 games, Round 2 (R32) = 16, Sweet 16 = 8, Elite 8 = 4, FF = 2, Champ = 1
// We detect round from the notes field or just track by date ranges
const ROUND_BY_DATE = [
  { round: 1, start: '2026-03-19', end: '2026-03-20', pts: 1 },  // R64
  { round: 2, start: '2026-03-21', end: '2026-03-22', pts: 2 },  // R32
  { round: 3, start: '2026-03-26', end: '2026-03-27', pts: 4 },  // S16
  { round: 4, start: '2026-03-28', end: '2026-03-29', pts: 8 },  // E8
  { round: 5, start: '2026-04-04', end: '2026-04-04', pts: 8 },  // FF
  { round: 6, start: '2026-04-06', end: '2026-04-06', pts: 16 }, // Championship
];

const getRoundInfo = (gameDateStr) => {
  const gameDate = gameDateStr.substring(0, 10);
  for (const r of ROUND_BY_DATE) {
    if (gameDate >= r.start && gameDate <= r.end) return r;
  }
  return null; // First Four — not scored
};

const NAME_MAP = {
  'North Carolina': 'N. Carolina',
  'Northern Iowa': 'N. Iowa',
  'North Dakota St': 'N. Dakota St.',
  'N Dakota St': 'N. Dakota St.',
  'Michigan State': 'Michigan St.',
  'Kennesaw St': 'Kennesaw St.',
  'Tennessee State': 'Tennessee St.',
  'Tennessee St': 'Tennessee St.',
  'Long Island': 'LIU',
  "Saint Mary's": "St. Mary's",
  "St Mary's": "St. Mary's",
  'Howard': 'UMBC/Howard',
  'Texas': 'TX/NC State',
  'SMU': 'MiamiOH/SMU',
  'Miami OH': 'MiamiOH/SMU',
  'Miami (OH)': 'MiamiOH/SMU',
  'Lehigh': 'PVA&M/Lehigh',
  'Prairie View': 'PVA&M/Lehigh',
  'Prairie View A&M': 'PVA&M/Lehigh',
  'Miami': 'Miami FL',
  'California Baptist': 'Cal Baptist',
  'Saint Louis': 'Saint Louis',
};
const normalize = (name) => NAME_MAP[name] || name;

// ── SCORING: round-aware ──
// results rows now have a `round` field (1=R64, 2=R32, 3=S16, 4=E8, 5=FF, 6=Champ)
// picks.rounds[1] = teams picked to win R64 (score in round 1)
// picks.rounds[2] = teams picked to win R32 (score in round 2)
// etc.
const scoreAllBrackets = async () => {
  const { data: brackets } = await supabase.from('brackets').select('*');
  const { data: results } = await supabase.from('results').select('*').eq('completed', true);

  // Build a map: { round -> Set of winners }
  const winnersByRound = {};
  for (const r of results || []) {
    if (!r.round) continue;
    if (!winnersByRound[r.round]) winnersByRound[r.round] = new Set();
    winnersByRound[r.round].add(r.winner);
  }

  for (const bracket of brackets || []) {
    let score = 0;
    const picks = bracket.picks;
    if (!picks) continue;

    for (const region of ['East', 'West', 'South', 'Midwest']) {
      const rounds = picks[region]?.rounds || [];
      // rounds[1] = picked R64 winners → score against round 1 results (1pt)
      // rounds[2] = picked R32 winners → score against round 2 results (2pt)
      // rounds[3] = picked S16 winners → score against round 3 results (4pt)
      // rounds[4] = picked E8 winners  → score against round 4 results (8pt)
      for (let roundIdx = 1; roundIdx <= 4; roundIdx++) {
        const roundWinners = winnersByRound[roundIdx] || new Set();
        const pts = Math.pow(2, roundIdx - 1);
        (rounds[roundIdx] || []).forEach((team) => {
          if (team && roundWinners.has(team.name)) score += pts;
        });
      }
    }

    // Final Four semis = round 5, 8pts each
    const r5 = winnersByRound[5] || new Set();
    if (picks.semi1Winner && r5.has(picks.semi1Winner.name)) score += 8;
    if (picks.semi2Winner && r5.has(picks.semi2Winner.name)) score += 8;

    // Championship = round 6, 16pts
    const r6 = winnersByRound[6] || new Set();
    if (picks.champion && r6.has(picks.champion.name)) score += 16;

    await supabase.from('brackets').update({ score }).eq('user_id', bracket.user_id);
  }

  return { brackets, winnersByRound };
};

const ALL_MATCHUPS = [
  { id: "ff1", round: 0, label: "First Four", team1: "UMBC/Howard", team2: "Howard/UMBC" },
  { id: "ff2", round: 0, label: "First Four", team1: "TX/NC State", team2: "NC State/Texas" },
  { id: "ff3", round: 0, label: "First Four", team1: "PVA&M/Lehigh", team2: "Lehigh/PVA&M" },
  { id: "ff4", round: 0, label: "First Four", team1: "MiamiOH/SMU", team2: "SMU/MiamiOH" },
  { id: "e1", round: 1, label: "East R64", team1: "Duke", team2: "Siena" },
  { id: "e2", round: 1, label: "East R64", team1: "Ohio State", team2: "TCU" },
  { id: "e3", round: 1, label: "East R64", team1: "St. John's", team2: "N. Iowa" },
  { id: "e4", round: 1, label: "East R64", team1: "Kansas", team2: "Cal Baptist" },
  { id: "e5", round: 1, label: "East R64", team1: "Louisville", team2: "South Florida" },
  { id: "e6", round: 1, label: "East R64", team1: "Michigan St.", team2: "N. Dakota St." },
  { id: "e7", round: 1, label: "East R64", team1: "UCLA", team2: "UCF" },
  { id: "e8", round: 1, label: "East R64", team1: "UConn", team2: "Furman" },
  { id: "w1", round: 1, label: "West R64", team1: "Arizona", team2: "LIU" },
  { id: "w2", round: 1, label: "West R64", team1: "Villanova", team2: "Utah State" },
  { id: "w3", round: 1, label: "West R64", team1: "Wisconsin", team2: "High Point" },
  { id: "w4", round: 1, label: "West R64", team1: "Arkansas", team2: "Hawai'i" },
  { id: "w5", round: 1, label: "West R64", team1: "BYU", team2: "TX/NC State" },
  { id: "w6", round: 1, label: "West R64", team1: "Gonzaga", team2: "Kennesaw St." },
  { id: "w7", round: 1, label: "West R64", team1: "Miami FL", team2: "Missouri" },
  { id: "w8", round: 1, label: "West R64", team1: "Purdue", team2: "Queens" },
  { id: "s1", round: 1, label: "South R64", team1: "Florida", team2: "PVA&M/Lehigh" },
  { id: "s2", round: 1, label: "South R64", team1: "Clemson", team2: "Iowa" },
  { id: "s3", round: 1, label: "South R64", team1: "Vanderbilt", team2: "McNeese" },
  { id: "s4", round: 1, label: "South R64", team1: "Nebraska", team2: "Troy" },
  { id: "s5", round: 1, label: "South R64", team1: "N. Carolina", team2: "VCU" },
  { id: "s6", round: 1, label: "South R64", team1: "Illinois", team2: "Penn" },
  { id: "s7", round: 1, label: "South R64", team1: "St. Mary's", team2: "Texas A&M" },
  { id: "s8", round: 1, label: "South R64", team1: "Houston", team2: "Idaho" },
  { id: "m1", round: 1, label: "Midwest R64", team1: "Michigan", team2: "UMBC/Howard" },
  { id: "m2", round: 1, label: "Midwest R64", team1: "Georgia", team2: "Saint Louis" },
  { id: "m3", round: 1, label: "Midwest R64", team1: "Texas Tech", team2: "Akron" },
  { id: "m4", round: 1, label: "Midwest R64", team1: "Alabama", team2: "Hofstra" },
  { id: "m5", round: 1, label: "Midwest R64", team1: "Tennessee", team2: "MiamiOH/SMU" },
  { id: "m6", round: 1, label: "Midwest R64", team1: "Virginia", team2: "Wright State" },
  { id: "m7", round: 1, label: "Midwest R64", team1: "Kentucky", team2: "Santa Clara" },
  { id: "m8", round: 1, label: "Midwest R64", team1: "Iowa State", team2: "Tennessee St." },
];

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
  :root { --orange: #FF5722; --orange-dim: #cc4418; --cream: #FFF8F0; --ink: #1A1208; --mid: #8a7060; --surface: #ffffff; --border: #e8ddd0; --green: #2ECC71; --red: #e74c3c; --shadow: 0 2px 12px rgba(26,18,8,0.10); }
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
  .tl-dot.done { background: var(--green); }
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
  .nav-btn.admin-btn { color: rgba(255,165,0,0.7); }
  .nav-btn.admin-btn.active { color: orange; }
  .topbar-user { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.7); }
  .avatar { width: 32px; height: 32px; background: var(--orange); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white; }
  .signout-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); font-size: 11px; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
  .signout-btn:hover { border-color: rgba(255,255,255,0.5); color: white; }
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
  .admin-page { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  .admin-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: var(--ink); margin-bottom: 4px; }
  .admin-meta { font-size: 13px; color: var(--mid); margin-bottom: 24px; }
  .admin-espn-btn { display: flex; align-items: center; gap: 10px; background: var(--orange); color: white; border: none; padding: 14px 28px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700; border-radius: 4px; cursor: pointer; margin-bottom: 12px; transition: all 0.15s; width: 100%; justify-content: center; }
  .admin-espn-btn:hover { background: var(--orange-dim); }
  .admin-espn-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .admin-espn-result { font-size: 13px; padding: 10px 14px; border-radius: 4px; margin-bottom: 24px; font-weight: 500; }
  .admin-espn-result.success { background: #eafaf1; color: #1a7a40; border: 1.5px solid #a8e6c0; }
  .admin-espn-result.error { background: #fdf0f0; color: #a00; border: 1.5px solid #f5c0c0; }
  .admin-divider { border: none; border-top: 1.5px solid var(--border); margin: 28px 0; }
  .admin-manual-label { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--mid); margin-bottom: 6px; }
  .admin-manual-note { font-size: 12px; color: var(--mid); margin-bottom: 20px; }
  .admin-rescore-btn { background: var(--ink); color: white; border: none; padding: 10px 24px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; border-radius: 3px; cursor: pointer; margin-bottom: 28px; transition: all 0.15s; }
  .admin-rescore-btn:hover { background: var(--orange); }
  .admin-rescore-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .admin-group { margin-bottom: 24px; }
  .admin-group-label { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.08em; color: var(--orange); margin-bottom: 8px; }
  .admin-game { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .admin-game-teams { flex: 1; font-size: 13px; font-weight: 500; }
  .admin-pick-btn { padding: 5px 12px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border-radius: 3px; cursor: pointer; border: 1.5px solid var(--border); background: white; color: var(--ink); transition: all 0.12s; }
  .admin-pick-btn:hover { border-color: var(--orange); color: var(--orange); }
  .admin-pick-btn.winner { background: var(--green); border-color: var(--green); color: white; }
  .admin-winner-display { font-size: 12px; color: var(--green); font-weight: 600; min-width: 100px; }
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

const TimelineItem = ({ date, desc, status }) => (
  <div className="timeline-item">
    <div className={`tl-dot ${status}`} />
    <span className="tl-date">{date}</span>
    <span className={`tl-desc${status === "now" ? " now" : ""}`}>{desc}</span>
  </div>
);

const Leaderboard = ({ currentUserId }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("brackets").select("user_id, user_name, user_email, score, picks").order("score", { ascending: false });
      setEntries(data || []); setLoading(false);
    };
    fetchData();
    const ch = supabase.channel("lb").on("postgres_changes", { event: "*", schema: "public", table: "brackets" }, fetchData).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  const max = entries[0]?.score || 1;
  if (loading) return <div className="loading">Loading...</div>;
  return (
    <div className="leaderboard-page">
      <div className="lb-title">Leaderboard</div>
      <div className="lb-meta"><span className="live-dot" /><span>Live · 2026 NCAA Tournament</span></div>
      {entries.length === 0 && <div className="lb-empty">No brackets yet. Be the first! 🏀</div>}
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

const AdminPanel = ({ onToast }) => {
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [gameWinners, setGameWinners] = useState({});
  const [rescoring, setRescoring] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("results").select("*");
      if (data) {
        const map = {};
        data.forEach((r) => { map[r.espn_game_id] = r.winner; });
        setGameWinners(map);
      }
    };
    load();
  }, []);

  const fetchESPNAndScore = async () => {
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&dates=20260317-20260406'
      );
      const data = await res.json();
      const events = data.events || [];

      const completedGames = events
        .filter((e) => e.status.type.completed)
        .map((e) => {
          const comp = e.competitions[0];
          const winner = comp.competitors.find((c) => c.winner);
          const rawWinner = winner?.team.shortDisplayName || null;
          const roundInfo = getRoundInfo(e.date);
          return {
            espn_game_id: e.id,
            round: roundInfo ? roundInfo.round : null,
            home_team: normalize(comp.competitors.find((c) => c.homeAway === 'home')?.team.shortDisplayName),
            away_team: normalize(comp.competitors.find((c) => c.homeAway === 'away')?.team.shortDisplayName),
            winner: rawWinner ? normalize(rawWinner) : null,
            game_date: e.date,
            completed: true,
          };
        })
        .filter((g) => g.winner && g.round !== null); // skip First Four (round=null)

      if (completedGames.length === 0) {
        setFetchResult({ type: 'error', msg: 'No completed scoreable games yet. First Four games don\'t count for points.' });
        setFetching(false);
        return;
      }

      await supabase.from('results').upsert(completedGames, { onConflict: 'espn_game_id' });

      const newMap = { ...gameWinners };
      completedGames.forEach((g) => { newMap[g.espn_game_id] = g.winner; });
      setGameWinners(newMap);

      const { brackets, winnersByRound } = await scoreAllBrackets();

      const allWinners = Object.values(winnersByRound).flatMap(s => [...s]);
      setFetchResult({
        type: 'success',
        msg: `✓ ${completedGames.length} games · ${brackets?.length} brackets updated · Winners: ${allWinners.join(', ')}`
      });
      onToast(`✓ Scores updated! ${completedGames.length} games processed.`);

    } catch (e) {
      setFetchResult({ type: 'error', msg: `Error: ${e.message}` });
    }
    setFetching(false);
  };

  const setWinner = async (matchup, winner) => {
    setGameWinners((prev) => ({ ...prev, [matchup.id]: winner }));
    await supabase.from("results").upsert({
      espn_game_id: matchup.id,
      round: matchup.round,
      home_team: matchup.team1,
      away_team: matchup.team2,
      winner,
      completed: true,
      game_date: new Date().toISOString(),
    }, { onConflict: "espn_game_id" });
  };

  const handleRescoreAll = async () => {
    setRescoring(true);
    try {
      const { brackets } = await scoreAllBrackets();
      onToast(`✓ Rescored ${brackets?.length} brackets`);
    } catch (e) {
      onToast("Error rescoring — try again");
    }
    setRescoring(false);
  };

  const groups = ALL_MATCHUPS.reduce((acc, m) => {
    if (!acc[m.label]) acc[m.label] = [];
    acc[m.label].push(m);
    return acc;
  }, {});

  return (
    <div className="admin-page">
      <div className="admin-title">Admin Panel</div>
      <div className="admin-meta">Only visible to you</div>
      <button className="admin-espn-btn" onClick={fetchESPNAndScore} disabled={fetching}>
        {fetching ? "⏳ Fetching ESPN & Scoring..." : "🏀 Fetch ESPN Scores & Update Leaderboard"}
      </button>
      {fetchResult && <div className={`admin-espn-result ${fetchResult.type}`}>{fetchResult.msg}</div>}
      <hr className="admin-divider" />
      <div className="admin-manual-label">Manual Fallback</div>
      <div className="admin-manual-note">Click winners manually then hit Rescore.</div>
      <button className="admin-rescore-btn" onClick={handleRescoreAll} disabled={rescoring}>
        {rescoring ? "Rescoring..." : "⚡ Rescore All Brackets Now"}
      </button>
      {Object.entries(groups).map(([label, matchups]) => (
        <div key={label} className="admin-group">
          <div className="admin-group-label">{label}</div>
          {matchups.map((m) => (
            <div key={m.id} className="admin-game">
              <div className="admin-game-teams">{m.team1} vs {m.team2}</div>
              <button className={`admin-pick-btn${gameWinners[m.id] === m.team1 ? " winner" : ""}`}
                onClick={() => setWinner(m, m.team1)}>{m.team1}</button>
              <button className={`admin-pick-btn${gameWinners[m.id] === m.team2 ? " winner" : ""}`}
                onClick={() => setWinner(m, m.team2)}>{m.team2}</button>
              {gameWinners[m.id] && <div className="admin-winner-display">✓ {gameWinners[m.id]}</div>}
            </div>
          ))}
        </div>
      ))}
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

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleLogin = async () => { await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } }); };
  const handleSignOut = async () => { await supabase.auth.signOut(); setSession(null); setBracket(buildInitialBracket()); setSaved(false); setTotalPicks(0); };

  const handlePick = (region, round, matchupIdx, teamIdx) => {
    setBracket((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const team = next[region].rounds[round][matchupIdx * 2 + teamIdx];
      if (!team) return prev;
      next[region].rounds[round + 1][matchupIdx] = team;
      for (let r = round + 2; r < 5; r++) { next[region].rounds[r][Math.floor(matchupIdx / Math.pow(2, r - round - 1))] = null; }
      if (region === "East" || region === "South") { next.semi1Winner = null; next.champion = null; }
      if (region === "West" || region === "Midwest") { next.semi2Winner = null; next.champion = null; }
      setSaved(false);
      setTotalPicks(countPicks(next));
      return next;
    });
  };

  const pickSemi1 = (team) => { setBracket((p) => { const n = { ...p, semi1Winner: team, champion: null }; setSaved(false); setTotalPicks(countPicks(n)); return n; }); };
  const pickSemi2 = (team) => { setBracket((p) => { const n = { ...p, semi2Winner: team, champion: null }; setSaved(false); setTotalPicks(countPicks(n)); return n; }); };
  const pickChampion = (team) => { setBracket((p) => { const n = { ...p, champion: team }; setSaved(false); setTotalPicks(countPicks(n)); return n; }); };

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
  const southWinner = bracket.South.rounds[4][0];
  const westWinner = bracket.West.rounds[4][0];
  const midwestWinner = bracket.Midwest.rounds[4][0];
  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  if (authLoading) return <div className="loading">BOL MADNESS</div>;

  if (!session) {
    return (
      <div className="landing">
        <div className="landing-inner">
          <div className="landing-eyebrow">BOL Agency · 2026</div>
          <div className="landing-title">MARCH<br /><span>MADNESS</span></div>
          <div className="landing-sub">The bracket is live. Sign in and make your picks.</div>
          <div className="timeline">
            <TimelineItem date="Sun Mar 15" desc="Selection Sunday — bracket revealed" status="done" />
            <TimelineItem date="Tue Mar 17" desc="First Four · Dayton, OH" status="done" />
            <TimelineItem date="Thu Mar 19" desc="Round of 64 tips off" status="now" />
            <TimelineItem date="Sat Apr 4" desc="Final Four · Indianapolis" status="upcoming" />
          </div>
          <button className="google-btn" onClick={handleLogin}><span className="google-icon">G</span>Sign in with Google</button>
          <div className="deadline-note">BOL Google accounts only</div>
        </div>
      </div>
    );
  }

  const userName = session.user.user_metadata?.full_name || session.user.email;

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, marginBottom: 8 }}>Bracket Pending</div>
              <div style={{ color: "var(--mid)", fontSize: 14 }}>Check back after Selection Sunday.</div>
            </div>
          </div>
        )}
        {tab === "leaderboard" && <Leaderboard currentUserId={session.user.id} />}
      </div>
    );
  }

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      <div className="topbar">
        <div className="topbar-brand">BOL <span>MADNESS</span></div>
        <div className="topbar-nav">
          <button className={`nav-btn${tab === "bracket" ? " active" : ""}`} onClick={() => setTab("bracket")}>My Bracket</button>
          <button className={`nav-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Leaderboard</button>
          {isAdmin && <button className={`nav-btn admin-btn${tab === "admin" ? " active" : ""}`} onClick={() => setTab("admin")}>⚙ Admin</button>}
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
            <div className="bracket-meta">2026 NCAA Tournament · <span className="picks-count">{totalPicks}</span> picks made · {63 - totalPicks} remaining</div>
            <div className="bracket-layout">
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <RegionBracket region="East" bracket={bracket} onPick={handlePick} flipped={false} />
                <RegionBracket region="South" bracket={bracket} onPick={handlePick} flipped={false} />
              </div>
              <div className="final-four-center">
                <div className="ff-section-label">Semifinal 1</div>
                <div className="ff-matchup">
                  <TeamSlot team={eastWinner} selected={bracket.semi1Winner?.name === eastWinner?.name} style={{ minWidth: 150 }} onClick={() => eastWinner && pickSemi1(eastWinner)} />
                  <div className="vs-divider">VS</div>
                  <TeamSlot team={southWinner} selected={bracket.semi1Winner?.name === southWinner?.name} style={{ minWidth: 150 }} onClick={() => southWinner && pickSemi1(southWinner)} />
                </div>
                <div className="championship-label">🏆 Championship</div>
                <div className="ff-matchup">
                  <TeamSlot team={bracket.semi1Winner} selected={bracket.champion?.name === bracket.semi1Winner?.name} style={{ minWidth: 150 }} onClick={() => bracket.semi1Winner && pickChampion(bracket.semi1Winner)} />
                  <div className="vs-divider">VS</div>
                  <TeamSlot team={bracket.semi2Winner} selected={bracket.champion?.name === bracket.semi2Winner?.name} style={{ minWidth: 150 }} onClick={() => bracket.semi2Winner && pickChampion(bracket.semi2Winner)} />
                </div>
                <div className="champion-slot">
                  <div className="champion-label">🏆 Champion</div>
                  <div className="champion-name">{bracket.champion?.name || "—"}</div>
                </div>
                <div className="ff-section-label">Semifinal 2</div>
                <div className="ff-matchup">
                  <TeamSlot team={westWinner} selected={bracket.semi2Winner?.name === westWinner?.name} style={{ minWidth: 150 }} onClick={() => westWinner && pickSemi2(westWinner)} />
                  <div className="vs-divider">VS</div>
                  <TeamSlot team={midwestWinner} selected={bracket.semi2Winner?.name === midwestWinner?.name} style={{ minWidth: 150 }} onClick={() => midwestWinner && pickSemi2(midwestWinner)} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <RegionBracket region="West" bracket={bracket} onPick={handlePick} flipped={true} />
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
      {tab === "admin" && isAdmin && <AdminPanel onToast={showToast} />}
    </div>
  );
}
