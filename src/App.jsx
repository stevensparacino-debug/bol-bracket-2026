import { useState, useEffect, useRef } from "react";
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
    { seed: 6,  name: "BYU" },            { seed: 11, name: "Texas" },
    { seed: 3,  name: "Gonzaga" },        { seed: 14, name: "Kennesaw St." },
    { seed: 7,  name: "Miami FL" },       { seed: 10, name: "Missouri" },
    { seed: 2,  name: "Purdue" },         { seed: 15, name: "Queens" },
  ],
  South: [
    { seed: 1,  name: "Florida" },        { seed: 16, name: "Prairie View" },
    { seed: 8,  name: "Clemson" },        { seed: 9,  name: "Iowa" },
    { seed: 5,  name: "Vanderbilt" },     { seed: 12, name: "McNeese" },
    { seed: 4,  name: "Nebraska" },       { seed: 13, name: "Troy" },
    { seed: 6,  name: "N. Carolina" },    { seed: 11, name: "VCU" },
    { seed: 3,  name: "Illinois" },       { seed: 14, name: "Penn" },
    { seed: 7,  name: "St. Mary's" },     { seed: 10, name: "Texas A&M" },
    { seed: 2,  name: "Houston" },        { seed: 15, name: "Idaho" },
  ],
  Midwest: [
    { seed: 1,  name: "Michigan" },       { seed: 16, name: "Howard" },
    { seed: 8,  name: "Georgia" },        { seed: 9,  name: "Saint Louis" },
    { seed: 5,  name: "Texas Tech" },     { seed: 12, name: "Akron" },
    { seed: 4,  name: "Alabama" },        { seed: 13, name: "Hofstra" },
    { seed: 6,  name: "Tennessee" },      { seed: 11, name: "SMU" },
    { seed: 3,  name: "Virginia" },       { seed: 14, name: "Wright State" },
    { seed: 7,  name: "Kentucky" },       { seed: 10, name: "Santa Clara" },
    { seed: 2,  name: "Iowa State" },     { seed: 15, name: "Tennessee St." },
  ],
};

const ADMIN_EMAIL = "steven.sparacino@bol-agency.com";
const BRACKET_PENDING = false;
const BRACKET_LOCKED = true;

const ROUND_BY_DATE = [
  { round: 1, start: '2026-03-19', end: '2026-03-20', pts: 1 },
  { round: 2, start: '2026-03-21', end: '2026-03-22', pts: 2 },
  { round: 3, start: '2026-03-26', end: '2026-03-27', pts: 4 },
  { round: 4, start: '2026-03-28', end: '2026-03-29', pts: 8 },
  { round: 5, start: '2026-04-04', end: '2026-04-04', pts: 8 },
  { round: 6, start: '2026-04-06', end: '2026-04-06', pts: 16 },
];

const getRoundInfo = (gameDateStr) => {
  const gameDate = gameDateStr.substring(0, 10);
  for (const r of ROUND_BY_DATE) {
    if (gameDate >= r.start && gameDate <= r.end) return r;
  }
  return null;
};

const NAME_MAP = {
  'North Carolina': 'N. Carolina', 'Northern Iowa': 'N. Iowa',
  'North Dakota St': 'N. Dakota St.', 'N Dakota St': 'N. Dakota St.',
  'Michigan State': 'Michigan St.', 'Kennesaw St': 'Kennesaw St.',
  'Tennessee State': 'Tennessee St.', 'Tennessee St': 'Tennessee St.',
  'Long Island': 'LIU', "Saint Mary's": "St. Mary's", "St Mary's": "St. Mary's",
  // First Four — map ESPN names AND legacy composite names to actual winners
  'Howard': 'Howard', 'UMBC/Howard': 'Howard',
  'Texas': 'Texas', 'TX/NC State': 'Texas',
  'SMU': 'SMU', 'MiamiOH/SMU': 'SMU', 'Miami OH': 'SMU', 'Miami (OH)': 'SMU',
  'Prairie View': 'Prairie View', 'Prairie View A&M': 'Prairie View',
  'PVA&M/Lehigh': 'Prairie View', 'Lehigh': 'Prairie View',
  // Other
  'Miami': 'Miami FL',
  'California Baptist': 'Cal Baptist', 'Saint Louis': 'Saint Louis',
};
const normalize = (name) => NAME_MAP[name] || name;

// Display-only map — converts legacy composite names in saved picks to clean names
const DISPLAY_MAP = {
  'TX/NC State': 'Texas',
  'UMBC/Howard': 'Howard',
  'PVA&M/Lehigh': 'Prairie View',
  'MiamiOH/SMU': 'SMU',
};
const displayName = (name) => DISPLAY_MAP[name] || name;

const scoreAllBrackets = async () => {
  const { data: brackets } = await supabase.from('brackets').select('*');
  const { data: results } = await supabase.from('results').select('*').eq('completed', true);
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
      for (let roundIdx = 1; roundIdx <= 4; roundIdx++) {
        const roundWinners = winnersByRound[roundIdx] || new Set();
        const pts = Math.pow(2, roundIdx - 1);
        (rounds[roundIdx] || []).forEach((team) => {
          if (team && roundWinners.has(team.name)) score += pts;
        });
      }
    }
    const r5 = winnersByRound[5] || new Set();
    if (picks.semi1Winner && r5.has(picks.semi1Winner.name)) score += 8;
    if (picks.semi2Winner && r5.has(picks.semi2Winner.name)) score += 8;
    const r6 = winnersByRound[6] || new Set();
    if (picks.champion && r6.has(picks.champion.name)) score += 16;
    await supabase.from('brackets').update({ score }).eq('user_id', bracket.user_id);
  }
  return { brackets, winnersByRound };
};

const ALL_MATCHUPS = [
  { id: "ff1", round: 0, label: "First Four", team1: "Howard", team2: "UMBC" },
  { id: "ff2", round: 0, label: "First Four", team1: "Texas", team2: "NC State" },
  { id: "ff3", round: 0, label: "First Four", team1: "Prairie View", team2: "Lehigh" },
  { id: "ff4", round: 0, label: "First Four", team1: "SMU", team2: "Miami OH" },
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
  { id: "w5", round: 1, label: "West R64", team1: "BYU", team2: "Texas" },
  { id: "w6", round: 1, label: "West R64", team1: "Gonzaga", team2: "Kennesaw St." },
  { id: "w7", round: 1, label: "West R64", team1: "Miami FL", team2: "Missouri" },
  { id: "w8", round: 1, label: "West R64", team1: "Purdue", team2: "Queens" },
  { id: "s1", round: 1, label: "South R64", team1: "Florida", team2: "Prairie View" },
  { id: "s2", round: 1, label: "South R64", team1: "Clemson", team2: "Iowa" },
  { id: "s3", round: 1, label: "South R64", team1: "Vanderbilt", team2: "McNeese" },
  { id: "s4", round: 1, label: "South R64", team1: "Nebraska", team2: "Troy" },
  { id: "s5", round: 1, label: "South R64", team1: "N. Carolina", team2: "VCU" },
  { id: "s6", round: 1, label: "South R64", team1: "Illinois", team2: "Penn" },
  { id: "s7", round: 1, label: "South R64", team1: "St. Mary's", team2: "Texas A&M" },
  { id: "s8", round: 1, label: "South R64", team1: "Houston", team2: "Idaho" },
  { id: "m1", round: 1, label: "Midwest R64", team1: "Michigan", team2: "Howard" },
  { id: "m2", round: 1, label: "Midwest R64", team1: "Georgia", team2: "Saint Louis" },
  { id: "m3", round: 1, label: "Midwest R64", team1: "Texas Tech", team2: "Akron" },
  { id: "m4", round: 1, label: "Midwest R64", team1: "Alabama", team2: "Hofstra" },
  { id: "m5", round: 1, label: "Midwest R64", team1: "Tennessee", team2: "SMU" },
  { id: "m6", round: 1, label: "Midwest R64", team1: "Virginia", team2: "Wright State" },
  { id: "m7", round: 1, label: "Midwest R64", team1: "Kentucky", team2: "Santa Clara" },
  { id: "m8", round: 1, label: "Midwest R64", team1: "Iowa State", team2: "Tennessee St." },
];

const MOBILE_TABS = ["East", "West", "South", "Midwest", "FF"];

const buildInitialBracket = () => {
  const bracket = {};
  REGIONS.forEach((region) => {
    bracket[region] = {
      rounds: [
        TEAMS[region].map((t) => ({ ...t, region })),
        Array(8).fill(null), Array(4).fill(null),
        Array(2).fill(null), Array(1).fill(null),
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
  :root {
    --orange: #FF5722; --orange-dim: #cc4418; --cream: #FFF8F0; --ink: #1A1208;
    --mid: #8a7060; --surface: #ffffff; --border: #e8ddd0; --green: #2ECC71;
    --red: #e74c3c; --shadow: 0 2px 12px rgba(26,18,8,0.10);
    --slot-h: 38px; --slot-font: 13px; --seed-font: 10px;
  }
  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--ink); min-height: 100vh; }

  /* ── LANDING ── */
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

  /* ── APP SHELL ── */
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
  .topbar-user .name { display: none; }
  @media (min-width: 640px) { .topbar-user .name { display: block; } }
  .avatar { width: 32px; height: 32px; background: var(--orange); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white; flex-shrink: 0; }
  .signout-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); font-size: 11px; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
  .signout-btn:hover { border-color: rgba(255,255,255,0.5); color: white; }

  /* ── LOCK BANNER ── */
  .lock-banner { background: #1a1208; border-bottom: 2px solid var(--orange); padding: 8px 24px; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); }
  .lock-banner span { color: var(--orange); }

  /* ── DESKTOP BRACKET PAGE ── */
  .bracket-page { padding: 24px 16px 40px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .bracket-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: var(--ink); margin-bottom: 4px; }
  .bracket-meta { font-size: 14px; color: var(--mid); margin-bottom: 12px; }
  .picks-count { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: var(--orange); }
  .bracket-legend { display: flex; gap: 16px; margin-bottom: 20px; font-size: 12px; color: var(--mid); align-items: center; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 2px; }
  .legend-dot.correct { background: #e8f8ef; border: 1.5px solid var(--green); }
  .legend-dot.eliminated { background: #f5f0eb; border: 1.5px solid #c8c0b8; }
  .legend-dot.live { background: #fff3e0; border: 1.5px solid var(--orange); }
  .live-games-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .live-game-chip { background: var(--ink); color: white; border-radius: 4px; padding: 5px 10px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .live-game-chip .live-pip { width: 6px; height: 6px; background: var(--orange); border-radius: 50%; animation: pulse 1.5s infinite; }
  .bracket-layout { display: flex; gap: 0; min-width: 1200px; align-items: center; justify-content: center; }
  .region-block { flex: 1; }
  .region-label { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.08em; color: var(--orange); text-align: center; margin-bottom: 14px; }
  .rounds-row { display: flex; gap: 0; }
  .round-col { display: flex; flex-direction: column; justify-content: space-around; min-width: 128px; padding: 0 3px; }
  .matchup { display: flex; flex-direction: column; gap: 2px; margin: 4px 0; }

  /* ── TEAM SLOT ── */
  .team-slot {
    display: flex; align-items: center; gap: 6px; padding: 0 8px;
    background: var(--surface); border: 1.5px solid var(--border); border-radius: 4px;
    cursor: pointer; transition: all 0.12s;
    min-height: var(--slot-h); font-size: var(--slot-font); font-weight: 500;
    color: var(--ink); user-select: none; overflow: hidden; position: relative;
  }
  .team-slot.locked { cursor: default; }
  .team-slot:hover:not(.empty):not(.eliminated):not(.locked) { border-color: var(--orange); background: #fff5f0; }
  .team-slot.selected { background: var(--orange); border-color: var(--orange); color: white; }
  .team-slot.correct { background: #e8f8ef !important; border-color: var(--green) !important; color: var(--ink) !important; }
  .team-slot.correct .seed-badge { color: var(--green) !important; }
  .team-slot.eliminated { background: #f5f0eb; border-color: #c8c0b8; color: #b0a898; cursor: default; }
  .team-slot.eliminated .team-name { text-decoration: line-through; opacity: 0.55; }
  .team-slot.live-game { border-color: var(--orange); background: #fff8f0; }
  .team-slot.empty { background: #f5f0eb; border-color: #e0d8d0; cursor: default; }
  .seed-badge { font-size: var(--seed-font); font-weight: 700; color: var(--mid); min-width: 16px; flex-shrink: 0; }
  .team-slot.selected .seed-badge { color: rgba(255,255,255,0.7); }
  .team-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
  .live-score { font-size: 11px; font-weight: 700; color: var(--orange); margin-left: auto; flex-shrink: 0; }
  .result-badge { font-size: 10px; font-weight: 700; margin-left: auto; flex-shrink: 0; }
  .result-badge.correct { color: var(--green); }
  .result-badge.eliminated { color: #b0a898; }

  /* ── FINAL FOUR (desktop) ── */
  .final-four-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 200px; padding: 0 16px; gap: 4px; }
  .ff-section-label { font-family: 'Bebas Neue', sans-serif; font-size: 12px; letter-spacing: 0.12em; color: var(--mid); text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  .ff-matchup { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
  .vs-divider { text-align: center; font-size: 10px; font-weight: 700; color: var(--mid); letter-spacing: 0.1em; margin: 2px 0; }
  .champion-slot { background: var(--ink); border: 2px solid var(--orange); border-radius: 4px; padding: 12px 16px; text-align: center; min-width: 160px; margin: 10px 0; }
  .champion-label { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin-bottom: 4px; }
  .champion-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: white; }
  .championship-label { font-family: 'Bebas Neue', sans-serif; font-size: 12px; letter-spacing: 0.12em; color: var(--orange); text-align: center; margin-bottom: 4px; }

  /* ── SAVE BAR ── */
  .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--ink); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 200; border-top: 2px solid var(--orange); gap: 12px; }
  .save-bar-text { color: rgba(255,255,255,0.7); font-size: 13px; white-space: nowrap; }
  .save-bar-text strong { color: white; }
  .save-btn { background: var(--orange); color: white; border: none; padding: 10px 28px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; border-radius: 3px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .save-btn:hover { background: var(--orange-dim); }
  .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .saved-badge { background: var(--green); color: white; padding: 10px 20px; border-radius: 3px; font-size: 13px; font-weight: 600; white-space: nowrap; }

  /* ── MOBILE REGION TABS ── */
  .mobile-tabs { display: none; }
  @media (max-width: 767px) {
    .desktop-bracket { display: none; }
    .mobile-tabs { display: flex; background: var(--ink); border-bottom: 2px solid var(--border); overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .mobile-tab { flex: 1; min-width: 60px; padding: 10px 4px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.05em; text-align: center; background: transparent; border: none; color: rgba(255,255,255,0.45); cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.15s; white-space: nowrap; }
    .mobile-tab.active { color: var(--orange); border-bottom-color: var(--orange); }
    .mobile-bracket-view { padding: 16px 12px 40px; }
    .mobile-region-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: var(--orange); margin-bottom: 12px; }
    .mobile-rounds { display: flex; flex-direction: column; gap: 8px; }
    .mobile-round-header { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.12em; color: var(--mid); text-transform: uppercase; margin: 16px 0 6px; }
    .mobile-matchup-card { background: white; border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden; }
    .mobile-team-row {
      display: flex; align-items: center; gap: 8px; padding: 10px 12px;
      font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.12s;
      min-height: 44px; border-bottom: 1px solid var(--border);
    }
    .mobile-team-row:last-child { border-bottom: none; }
    .mobile-team-row.locked { cursor: default; }
    .mobile-team-row:hover:not(.eliminated):not(.locked) { background: #fff5f0; }
    .mobile-team-row.selected { background: var(--orange); color: white; }
    .mobile-team-row.selected .seed-badge { color: rgba(255,255,255,0.7); }
    .mobile-team-row.correct { background: #e8f8ef; border-left: 3px solid var(--green); }
    .mobile-team-row.correct .seed-badge { color: var(--green); }
    .mobile-team-row.eliminated { background: #f5f0eb; color: #b0a898; }
    .mobile-team-row.eliminated .mobile-team-name { text-decoration: line-through; opacity: 0.55; }
    .mobile-team-row.live-game { border-left: 3px solid var(--orange); background: #fff8f0; }
    .mobile-team-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mobile-result-badge { font-size: 12px; font-weight: 700; margin-left: auto; flex-shrink: 0; }
    .mobile-result-badge.correct { color: var(--green); }
    .mobile-result-badge.eliminated { color: #b0a898; }
    .mobile-live-score { font-size: 12px; font-weight: 700; color: var(--orange); margin-left: auto; flex-shrink: 0; }
    .mobile-ff { padding: 16px 12px 40px; }
    .mobile-ff-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: var(--orange); margin-bottom: 16px; }
    .mobile-ff-section { margin-bottom: 20px; }
    .mobile-ff-section-label { font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: 0.1em; color: var(--mid); text-transform: uppercase; margin-bottom: 8px; }
    .mobile-ff-card { background: white; border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden; }
    .mobile-champion-card { background: var(--ink); border: 2px solid var(--orange); border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .mobile-champion-label { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin-bottom: 6px; }
    .mobile-champion-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: white; }
    .mobile-live-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  }
  @media (min-width: 768px) {
    .mobile-bracket-view { display: none; }
    .mobile-ff { display: none; }
  }

  /* ── LEADERBOARD ── */
  .leaderboard-page { max-width: 680px; margin: 0 auto; padding: 32px 16px 80px; }
  .lb-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: var(--ink); margin-bottom: 4px; }
  .lb-meta { font-size: 13px; color: var(--mid); margin-bottom: 28px; display: flex; align-items: center; gap: 8px; }
  .live-dot { width: 8px; height: 8px; background: var(--green); border-radius: 50%; animation: pulse 2s infinite; flex-shrink: 0; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .lb-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 8px; transition: all 0.12s; }
  .lb-card:hover { border-color: var(--orange); box-shadow: var(--shadow); }
  .lb-card.me { border-color: var(--orange); background: #fff8f5; }
  .lb-row { display: flex; align-items: center; padding: 14px 18px; gap: 14px; }
  .lb-rank { font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: var(--mid); min-width: 32px; text-align: center; }
  .lb-rank.top { color: var(--orange); }
  .lb-avatar { width: 40px; height: 40px; background: var(--ink); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; }
  .lb-avatar.me-av { background: var(--orange); }
  .lb-info { flex: 1; min-width: 0; }
  .lb-name { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lb-detail { font-size: 12px; color: var(--mid); margin-top: 2px; }
  .lb-score { text-align: right; flex-shrink: 0; }
  .lb-pts { font-family: 'Bebas Neue', sans-serif; font-size: 30px; line-height: 1; }
  .lb-pts-label { font-size: 10px; color: var(--mid); text-transform: uppercase; letter-spacing: 0.08em; }
  .lb-bar-wrap { padding: 0 18px 14px; }
  .lb-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .lb-bar-fill { height: 100%; background: var(--orange); border-radius: 2px; transition: width 0.6s ease; }
  .lb-empty { text-align: center; padding: 60px 20px; color: var(--mid); font-size: 14px; }

  /* ── TOAST / LOADING ── */
  .toast { position: fixed; top: 72px; right: 20px; background: var(--ink); color: white; padding: 12px 20px; border-radius: 4px; font-size: 13px; font-weight: 500; border-left: 3px solid var(--orange); z-index: 999; animation: slideIn 0.2s ease; max-width: calc(100vw - 40px); }
  @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  .loading { display: flex; align-items: center; justify-content: center; height: 100vh; font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: var(--orange); letter-spacing: 0.1em; }

  /* ── ADMIN ── */
  .admin-page { max-width: 720px; margin: 0 auto; padding: 32px 16px 80px; }
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
  .admin-game { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .admin-game-teams { flex: 1; font-size: 13px; font-weight: 500; min-width: 120px; }
  .admin-pick-btn { padding: 6px 12px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border-radius: 3px; cursor: pointer; border: 1.5px solid var(--border); background: white; color: var(--ink); transition: all 0.12s; }
  .admin-pick-btn:hover { border-color: var(--orange); color: var(--orange); }
  .admin-pick-btn.winner { background: var(--green); border-color: var(--green); color: white; }
  .admin-winner-display { font-size: 12px; color: var(--green); font-weight: 600; }
`;

const ROUND_LABELS = ['R64', 'R32', 'S16', 'E8'];

const getInitials = (name) => name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

const countPicks = (b) => {
  let count = 0;
  REGIONS.forEach((r) => { for (let ri = 1; ri < 5; ri++) { b[r]?.rounds[ri]?.forEach((t) => { if (t) count++; }); } });
  if (b.semi1Winner) count++;
  if (b.semi2Winner) count++;
  if (b.champion) count++;
  return count;
};

const getTeamStatus = (teamName, roundIdx, winnersByRound, losersByRound) => {
  if (!teamName) return 'pending';
  const rw = winnersByRound[roundIdx];
  const rl = losersByRound[roundIdx];
  if (rw && rw.has(teamName)) return 'correct';
  if (rl && rl.has(teamName)) return 'eliminated';
  return 'pending';
};

const TeamSlot = ({ team, selected, onClick, style, status, liveScore, locked }) => {
  if (!team) return <div className="team-slot empty" style={style}>—</div>;
  const isLive = liveScore !== undefined;
  const statusClass = status === 'correct' ? ' correct' : status === 'eliminated' ? ' eliminated' : isLive ? ' live-game' : selected ? ' selected' : '';
  return (
    <div className={`team-slot${statusClass}${locked ? ' locked' : ''}`}
      onClick={() => !locked && status !== 'eliminated' && onClick && onClick()} title={displayName(team.name)} style={style}>
      <span className="seed-badge">{team.seed}</span>
      <span className="team-name">{displayName(team.name)}</span>
      {isLive && <span className="live-score">{liveScore}</span>}
      {!isLive && status === 'correct' && <span className="result-badge correct">✓</span>}
      {!isLive && status === 'eliminated' && <span className="result-badge eliminated">✗</span>}
    </div>
  );
};

const RegionBracket = ({ region, bracket, onPick, flipped, winnersByRound, losersByRound, liveScores, locked }) => {
  const rounds = bracket[region].rounds;
  const buildMatchups = (rt) => { const m = []; for (let i = 0; i < rt.length; i += 2) m.push([rt[i], rt[i+1]]); return m; };
  return (
    <div className="region-block">
      <div className="region-label">{region}</div>
      <div className="rounds-row" style={{ flexDirection: flipped ? "row-reverse" : "row" }}>
        {rounds.slice(0, 4).map((roundTeams, ri) => {
          const matchups = buildMatchups(roundTeams);
          const spacing = Math.pow(2, ri) * 9;
          return (
            <div key={ri} className="round-col">
              {matchups.map((pair, mi) => (
                <div key={mi} className="matchup" style={{ marginTop: mi === 0 ? spacing/2 : spacing, marginBottom: spacing/2 }}>
                  {pair.map((team, ti) => {
                    const statusRound = ri + 1;
                    const status = team ? getTeamStatus(team.name, statusRound, winnersByRound, losersByRound) : 'pending';
                    const isSelected = rounds[ri+1]?.[mi]?.name === team?.name;
                    const liveScore = team ? liveScores[team.name] : undefined;
                    return (
                      <TeamSlot key={ti} team={team}
                        selected={isSelected && status === 'pending' && !liveScore}
                        status={isSelected ? status : (status === 'eliminated' ? 'eliminated' : 'pending')}
                        liveScore={liveScore} locked={locked}
                        onClick={() => team && status !== 'eliminated' && !locked && onPick(region, ri, mi, ti)} />
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MobileRegionView = ({ region, bracket, onPick, winnersByRound, losersByRound, liveScores, locked }) => {
  const rounds = bracket[region].rounds;
  return (
    <div className="mobile-bracket-view">
      <div className="mobile-region-title">{region}</div>
      <div className="mobile-rounds">
        {rounds.slice(0, 4).map((roundTeams, ri) => {
          const label = ROUND_LABELS[ri];
          const pairs = [];
          for (let i = 0; i < roundTeams.length; i += 2) pairs.push([roundTeams[i], roundTeams[i+1], i/2]);
          return (
            <div key={ri}>
              <div className="mobile-round-header">{label}</div>
              {pairs.map(([t1, t2, mi]) => (
                <div key={mi} className="mobile-matchup-card" style={{ marginBottom: 8 }}>
                  {[t1, t2].map((team, ti) => {
                    if (!team) return <div key={ti} className="mobile-team-row eliminated"><span className="mobile-team-name" style={{ opacity: 0.4 }}>—</span></div>;
                    const statusRound = ri + 1;
                    const status = getTeamStatus(team.name, statusRound, winnersByRound, losersByRound);
                    const isSelected = rounds[ri+1]?.[mi]?.name === team?.name;
                    const liveScore = liveScores[team.name];
                    const isLive = liveScore !== undefined;
                    const cls = status === 'correct' ? 'correct' : status === 'eliminated' ? 'eliminated' : isLive ? 'live-game' : isSelected ? 'selected' : '';
                    return (
                      <div key={ti}
                        className={`mobile-team-row ${cls}${locked ? ' locked' : ''}`}
                        onClick={() => !locked && status !== 'eliminated' && onPick(region, ri, mi, ti)}>
                        <span className="seed-badge" style={{ minWidth: 20, fontSize: 11, fontWeight: 700, color: isSelected && !cls.includes('correct') ? 'rgba(255,255,255,0.7)' : 'var(--mid)' }}>{team.seed}</span>
                        <span className="mobile-team-name">{displayName(team.name)}</span>
                        {isLive && <span className="mobile-live-score">{liveScore}</span>}
                        {!isLive && status === 'correct' && <span className="mobile-result-badge correct">✓</span>}
                        {!isLive && status === 'eliminated' && <span className="mobile-result-badge eliminated">✗</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MobileFinalFour = ({ bracket, pickSemi1, pickSemi2, pickChampion, winnersByRound, losersByRound, liveScores, locked }) => {
  const eastW = bracket.East.rounds[4][0];
  const southW = bracket.South.rounds[4][0];
  const westW = bracket.West.rounds[4][0];
  const midwestW = bracket.Midwest.rounds[4][0];

  const FFRow = ({ team, selected, onClick, roundIdx }) => {
    if (!team) return <div className="mobile-team-row eliminated"><span className="mobile-team-name" style={{ opacity: 0.4 }}>Pick a region winner first</span></div>;
    const status = getTeamStatus(team.name, roundIdx, winnersByRound, losersByRound);
    const liveScore = liveScores[team.name];
    const isLive = liveScore !== undefined;
    const cls = status === 'correct' ? 'correct' : status === 'eliminated' ? 'eliminated' : isLive ? 'live-game' : selected ? 'selected' : '';
    return (
      <div className={`mobile-team-row ${cls}${locked ? ' locked' : ''}`}
        onClick={() => !locked && status !== 'eliminated' && onClick && onClick()}>
        <span className="seed-badge" style={{ minWidth: 20, fontSize: 11, fontWeight: 700, color: 'var(--mid)' }}>{team.seed}</span>
        <span className="mobile-team-name">{displayName(team.name)}</span>
        {isLive && <span className="mobile-live-score">{liveScore}</span>}
        {!isLive && status === 'correct' && <span className="mobile-result-badge correct">✓</span>}
        {!isLive && status === 'eliminated' && <span className="mobile-result-badge eliminated">✗</span>}
      </div>
    );
  };

  return (
    <div className="mobile-ff">
      <div className="mobile-ff-title">Final Four</div>
      <div className="mobile-champion-card">
        <div className="mobile-champion-label">🏆 Champion</div>
        <div className="mobile-champion-name">{bracket.champion?.name || "—"}</div>
      </div>
      <div className="mobile-ff-section">
        <div className="mobile-ff-section-label">Semifinal 1 — East vs South</div>
        <div className="mobile-ff-card">
          <FFRow team={eastW} selected={bracket.semi1Winner?.name === eastW?.name} onClick={() => eastW && pickSemi1(eastW)} roundIdx={5} />
          <FFRow team={southW} selected={bracket.semi1Winner?.name === southW?.name} onClick={() => southW && pickSemi1(southW)} roundIdx={5} />
        </div>
      </div>
      <div className="mobile-ff-section">
        <div className="mobile-ff-section-label">Championship</div>
        <div className="mobile-ff-card">
          <FFRow team={bracket.semi1Winner} selected={bracket.champion?.name === bracket.semi1Winner?.name} onClick={() => bracket.semi1Winner && pickChampion(bracket.semi1Winner)} roundIdx={6} />
          <FFRow team={bracket.semi2Winner} selected={bracket.champion?.name === bracket.semi2Winner?.name} onClick={() => bracket.semi2Winner && pickChampion(bracket.semi2Winner)} roundIdx={6} />
        </div>
      </div>
      <div className="mobile-ff-section">
        <div className="mobile-ff-section-label">Semifinal 2 — West vs Midwest</div>
        <div className="mobile-ff-card">
          <FFRow team={westW} selected={bracket.semi2Winner?.name === westW?.name} onClick={() => westW && pickSemi2(westW)} roundIdx={5} />
          <FFRow team={midwestW} selected={bracket.semi2Winner?.name === midwestW?.name} onClick={() => midwestW && pickSemi2(midwestW)} roundIdx={5} />
        </div>
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
      if (data) { const map = {}; data.forEach((r) => { map[r.espn_game_id] = r.winner; }); setGameWinners(map); }
    };
    load();
  }, []);
  const fetchESPNAndScore = async () => {
    setFetching(true); setFetchResult(null);
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&dates=20260317-20260406');
      const data = await res.json();
      const events = data.events || [];
      const completedGames = events.filter((e) => e.status.type.completed).map((e) => {
        const comp = e.competitions[0];
        const winner = comp.competitors.find((c) => c.winner);
        const rawWinner = winner?.team.shortDisplayName || null;
        const roundInfo = getRoundInfo(e.date);
        return {
          espn_game_id: e.id, round: roundInfo ? roundInfo.round : null,
          home_team: normalize(comp.competitors.find((c) => c.homeAway === 'home')?.team.shortDisplayName),
          away_team: normalize(comp.competitors.find((c) => c.homeAway === 'away')?.team.shortDisplayName),
          winner: rawWinner ? normalize(rawWinner) : null, game_date: e.date, completed: true,
        };
      }).filter((g) => g.winner && g.round !== null);
      if (completedGames.length === 0) { setFetchResult({ type: 'error', msg: "No completed scoreable games yet." }); setFetching(false); return; }
      await supabase.from('results').upsert(completedGames, { onConflict: 'espn_game_id' });
      const newMap = { ...gameWinners };
      completedGames.forEach((g) => { newMap[g.espn_game_id] = g.winner; });
      setGameWinners(newMap);
      const { brackets, winnersByRound } = await scoreAllBrackets();
      const allWinners = Object.values(winnersByRound).flatMap(s => [...s]);
      setFetchResult({ type: 'success', msg: `✓ ${completedGames.length} games · ${brackets?.length} brackets updated · Winners: ${allWinners.join(', ')}` });
      onToast(`✓ Scores updated! ${completedGames.length} games processed.`);
    } catch (e) { setFetchResult({ type: 'error', msg: `Error: ${e.message}` }); }
    setFetching(false);
  };
  const setWinner = async (matchup, winner) => {
    setGameWinners((prev) => ({ ...prev, [matchup.id]: winner }));
    await supabase.from("results").upsert({ espn_game_id: matchup.id, round: matchup.round, home_team: matchup.team1, away_team: matchup.team2, winner, completed: true, game_date: new Date().toISOString() }, { onConflict: "espn_game_id" });
  };
  const handleRescoreAll = async () => {
    setRescoring(true);
    try { const { brackets } = await scoreAllBrackets(); onToast(`✓ Rescored ${brackets?.length} brackets`); }
    catch (e) { onToast("Error rescoring — try again"); }
    setRescoring(false);
  };
  const groups = ALL_MATCHUPS.reduce((acc, m) => { if (!acc[m.label]) acc[m.label] = []; acc[m.label].push(m); return acc; }, {});
  return (
    <div className="admin-page">
      <div className="admin-title">Admin Panel</div>
      <div className="admin-meta">Only visible to you</div>
      <button className="admin-espn-btn" onClick={fetchESPNAndScore} disabled={fetching}>{fetching ? "⏳ Fetching ESPN & Scoring..." : "🏀 Fetch ESPN Scores & Update Leaderboard"}</button>
      {fetchResult && <div className={`admin-espn-result ${fetchResult.type}`}>{fetchResult.msg}</div>}
      <hr className="admin-divider" />
      <div className="admin-manual-label">Manual Fallback</div>
      <div className="admin-manual-note">Click winners manually then hit Rescore.</div>
      <button className="admin-rescore-btn" onClick={handleRescoreAll} disabled={rescoring}>{rescoring ? "Rescoring..." : "⚡ Rescore All Brackets Now"}</button>
      {Object.entries(groups).map(([label, matchups]) => (
        <div key={label} className="admin-group">
          <div className="admin-group-label">{label}</div>
          {matchups.map((m) => (
            <div key={m.id} className="admin-game">
              <div className="admin-game-teams">{m.team1} vs {m.team2}</div>
              <button className={`admin-pick-btn${gameWinners[m.id] === m.team1 ? " winner" : ""}`} onClick={() => setWinner(m, m.team1)}>{m.team1}</button>
              <button className={`admin-pick-btn${gameWinners[m.id] === m.team2 ? " winner" : ""}`} onClick={() => setWinner(m, m.team2)}>{m.team2}</button>
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
  const [mobileRegion, setMobileRegion] = useState("East");
  const [bracket, setBracket] = useState(buildInitialBracket());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [totalPicks, setTotalPicks] = useState(0);
  const [winnersByRound, setWinnersByRound] = useState({});
  const [losersByRound, setLosersByRound] = useState({});
  const [liveScores, setLiveScores] = useState({});
  const [liveGames, setLiveGames] = useState([]);
  const liveIntervalRef = useRef(null);

  useEffect(() => {
    const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); if (session) loadBracket(session.user.id); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { setSession(session); if (session) loadBracket(session.user.id); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadResults = async () => {
      const { data } = await supabase.from('results').select('*').eq('completed', true);
      if (!data) return;
      const wbr = {}, lbr = {};
      data.forEach((r) => {
        if (!r.round) return;
        if (!wbr[r.round]) wbr[r.round] = new Set();
        if (!lbr[r.round]) lbr[r.round] = new Set();
        wbr[r.round].add(r.winner);
        const loser = r.home_team === r.winner ? r.away_team : r.home_team;
        if (loser) lbr[r.round].add(loser);
      });
      setWinnersByRound(wbr); setLosersByRound(lbr);
    };
    loadResults();
    const ch = supabase.channel('results-watch').on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, loadResults).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const fetchLiveScores = async () => {
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100');
      const data = await res.json();
      const scores = {}, games = [];
      (data.events || []).filter((e) => !e.status.type.completed && e.status.type.state === 'in').forEach((e) => {
        const comp = e.competitions[0];
        const home = comp.competitors.find((c) => c.homeAway === 'home');
        const away = comp.competitors.find((c) => c.homeAway === 'away');
        if (!home || !away) return;
        const homeName = normalize(home.team.shortDisplayName);
        const awayName = normalize(away.team.shortDisplayName);
        scores[homeName] = home.score || '0';
        scores[awayName] = away.score || '0';
        const period = e.status.period;
        games.push({ home: homeName, away: awayName, homeScore: home.score || '0', awayScore: away.score || '0', clock: e.status.displayClock, period: period === 1 ? '1st' : period === 2 ? '2nd' : 'OT' });
      });
      setLiveScores(scores); setLiveGames(games);
    } catch (e) { /* silent fail */ }
  };

  useEffect(() => {
    fetchLiveScores();
    liveIntervalRef.current = setInterval(fetchLiveScores, 60000);
    return () => clearInterval(liveIntervalRef.current);
  }, []);

  const loadBracket = async (uid) => {
    const { data } = await supabase.from("brackets").select("picks").eq("user_id", uid).single();
    if (data?.picks) { setBracket(data.picks); setTotalPicks(countPicks(data.picks)); setSaved(true); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleLogin = async () => { await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } }); };
  const handleSignOut = async () => { await supabase.auth.signOut(); setSession(null); setBracket(buildInitialBracket()); setSaved(false); setTotalPicks(0); };

  const handlePick = (region, round, matchupIdx, teamIdx) => {
    if (BRACKET_LOCKED) return;
    setBracket((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const team = next[region].rounds[round][matchupIdx * 2 + teamIdx];
      if (!team) return prev;
      next[region].rounds[round + 1][matchupIdx] = team;
      for (let r = round + 2; r < 5; r++) { next[region].rounds[r][Math.floor(matchupIdx / Math.pow(2, r - round - 1))] = null; }
      if (region === "East" || region === "South") { next.semi1Winner = null; next.champion = null; }
      if (region === "West" || region === "Midwest") { next.semi2Winner = null; next.champion = null; }
      setSaved(false); setTotalPicks(countPicks(next)); return next;
    });
  };

  const pickSemi1 = (team) => { if (BRACKET_LOCKED) return; setBracket((p) => { const n = { ...p, semi1Winner: team, champion: null }; setSaved(false); setTotalPicks(countPicks(n)); return n; }); };
  const pickSemi2 = (team) => { if (BRACKET_LOCKED) return; setBracket((p) => { const n = { ...p, semi2Winner: team, champion: null }; setSaved(false); setTotalPicks(countPicks(n)); return n; }); };
  const pickChampion = (team) => { if (BRACKET_LOCKED) return; setBracket((p) => { const n = { ...p, champion: team }; setSaved(false); setTotalPicks(countPicks(n)); return n; }); };

  const handleSave = async () => {
    if (!session || BRACKET_LOCKED) return;
    setSaving(true);
    const { error } = await supabase.from("brackets").upsert({ user_id: session.user.id, user_email: session.user.email, user_name: session.user.user_metadata?.full_name || session.user.email, picks: bracket, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
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
            <button className={`nav-btn${tab === "bracket" ? " active" : ""}`} onClick={() => setTab("bracket")}>Bracket</button>
            <button className={`nav-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Scores</button>
          </div>
          <div className="topbar-user">
            <span className="name">{userName}</span>
            <div className="avatar">{getInitials(userName)}</div>
            <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, marginBottom: 8 }}>Bracket Pending</div>
            <div style={{ color: "var(--mid)", fontSize: 14 }}>Check back after Selection Sunday.</div>
          </div>
        </div>
      </div>
    );
  }

  const sharedBracketProps = { bracket, onPick: handlePick, winnersByRound, losersByRound, liveScores, locked: BRACKET_LOCKED };

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      <div className="topbar">
        <div className="topbar-brand">BOL <span>MADNESS</span></div>
        <div className="topbar-nav">
          <button className={`nav-btn${tab === "bracket" ? " active" : ""}`} onClick={() => setTab("bracket")}>Bracket</button>
          <button className={`nav-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Scores</button>
          {isAdmin && <button className={`nav-btn admin-btn${tab === "admin" ? " active" : ""}`} onClick={() => setTab("admin")}>⚙</button>}
        </div>
        <div className="topbar-user">
          <span className="name">{userName}</span>
          <div className="avatar">{getInitials(userName)}</div>
          <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      {BRACKET_LOCKED && <div className="lock-banner">🔒 <span>Brackets are locked</span> · View only</div>}

      {tab === "bracket" && (
        <>
          <div className="mobile-tabs">
            {MOBILE_TABS.map((t) => (
              <button key={t} className={`mobile-tab${mobileRegion === t ? " active" : ""}`} onClick={() => setMobileRegion(t)}>{t}</button>
            ))}
          </div>
          {liveGames.length > 0 && (
            <div className="mobile-bracket-view" style={{ paddingBottom: 0, paddingTop: 12 }}>
              <div className="mobile-live-bar">
                {liveGames.map((g, i) => (
                  <div key={i} className="live-game-chip">
                    <span className="live-pip" />
                    {g.away} {g.awayScore}–{g.homeScore} {g.home} · {g.clock} {g.period}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mobileRegion !== "FF"
            ? <MobileRegionView region={mobileRegion} {...sharedBracketProps} />
            : <MobileFinalFour bracket={bracket} pickSemi1={pickSemi1} pickSemi2={pickSemi2} pickChampion={pickChampion} winnersByRound={winnersByRound} losersByRound={losersByRound} liveScores={liveScores} locked={BRACKET_LOCKED} />
          }
          <div className="desktop-bracket">
            <div className="bracket-page">
              <div className="bracket-title">Your Bracket</div>
              <div className="bracket-meta">2026 NCAA Tournament · <span className="picks-count">{totalPicks}</span> picks made</div>
              <div className="bracket-legend">
                <div className="legend-item"><div className="legend-dot correct"></div><span>Correct ✓</span></div>
                <div className="legend-item"><div className="legend-dot eliminated"></div><span>Eliminated ✗</span></div>
                {liveGames.length > 0 && <div className="legend-item"><div className="legend-dot live"></div><span>Live score</span></div>}
              </div>
              {liveGames.length > 0 && (
                <div className="live-games-bar">
                  {liveGames.map((g, i) => (
                    <div key={i} className="live-game-chip">
                      <span className="live-pip" />
                      {g.away} {g.awayScore} – {g.homeScore} {g.home} · {g.clock} {g.period}
                    </div>
                  ))}
                </div>
              )}
              <div className="bracket-layout">
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  <RegionBracket region="East" {...sharedBracketProps} flipped={false} />
                  <RegionBracket region="South" {...sharedBracketProps} flipped={false} />
                </div>
                <div className="final-four-center">
                  <div className="ff-section-label">Semifinal 1</div>
                  <div className="ff-matchup">
                    <TeamSlot team={eastWinner} selected={bracket.semi1Winner?.name === eastWinner?.name} style={{ minWidth: 160 }} onClick={() => !BRACKET_LOCKED && eastWinner && pickSemi1(eastWinner)} status={eastWinner ? getTeamStatus(eastWinner.name, 5, winnersByRound, losersByRound) : 'pending'} liveScore={eastWinner ? liveScores[eastWinner.name] : undefined} locked={BRACKET_LOCKED} />
                    <div className="vs-divider">VS</div>
                    <TeamSlot team={southWinner} selected={bracket.semi1Winner?.name === southWinner?.name} style={{ minWidth: 160 }} onClick={() => !BRACKET_LOCKED && southWinner && pickSemi1(southWinner)} status={southWinner ? getTeamStatus(southWinner.name, 5, winnersByRound, losersByRound) : 'pending'} liveScore={southWinner ? liveScores[southWinner.name] : undefined} locked={BRACKET_LOCKED} />
                  </div>
                  <div className="championship-label">🏆 Championship</div>
                  <div className="ff-matchup">
                    <TeamSlot team={bracket.semi1Winner} selected={bracket.champion?.name === bracket.semi1Winner?.name} style={{ minWidth: 160 }} onClick={() => !BRACKET_LOCKED && bracket.semi1Winner && pickChampion(bracket.semi1Winner)} status={bracket.semi1Winner ? getTeamStatus(bracket.semi1Winner.name, 6, winnersByRound, losersByRound) : 'pending'} liveScore={bracket.semi1Winner ? liveScores[bracket.semi1Winner.name] : undefined} locked={BRACKET_LOCKED} />
                    <div className="vs-divider">VS</div>
                    <TeamSlot team={bracket.semi2Winner} selected={bracket.champion?.name === bracket.semi2Winner?.name} style={{ minWidth: 160 }} onClick={() => !BRACKET_LOCKED && bracket.semi2Winner && pickChampion(bracket.semi2Winner)} status={bracket.semi2Winner ? getTeamStatus(bracket.semi2Winner.name, 6, winnersByRound, losersByRound) : 'pending'} liveScore={bracket.semi2Winner ? liveScores[bracket.semi2Winner.name] : undefined} locked={BRACKET_LOCKED} />
                  </div>
                  <div className="champion-slot">
                    <div className="champion-label">🏆 Champion</div>
                    <div className="champion-name">{bracket.champion?.name || "—"}</div>
                  </div>
                  <div className="ff-section-label">Semifinal 2</div>
                  <div className="ff-matchup">
                    <TeamSlot team={westWinner} selected={bracket.semi2Winner?.name === westWinner?.name} style={{ minWidth: 160 }} onClick={() => !BRACKET_LOCKED && westWinner && pickSemi2(westWinner)} status={westWinner ? getTeamStatus(westWinner.name, 5, winnersByRound, losersByRound) : 'pending'} liveScore={westWinner ? liveScores[westWinner.name] : undefined} locked={BRACKET_LOCKED} />
                    <div className="vs-divider">VS</div>
                    <TeamSlot team={midwestWinner} selected={bracket.semi2Winner?.name === midwestWinner?.name} style={{ minWidth: 160 }} onClick={() => !BRACKET_LOCKED && midwestWinner && pickSemi2(midwestWinner)} status={midwestWinner ? getTeamStatus(midwestWinner.name, 5, winnersByRound, losersByRound) : 'pending'} liveScore={midwestWinner ? liveScores[midwestWinner.name] : undefined} locked={BRACKET_LOCKED} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  <RegionBracket region="West" {...sharedBracketProps} flipped={true} />
                  <RegionBracket region="Midwest" {...sharedBracketProps} flipped={true} />
                </div>
              </div>
            </div>
          </div>
          {!BRACKET_LOCKED && (
            <div className="save-bar">
              <div className="save-bar-text"><strong>{totalPicks} picks</strong> made</div>
              {saved ? <div className="saved-badge">✓ Saved</div> : (
                <button className="save-btn" onClick={handleSave} disabled={totalPicks === 0 || saving}>
                  {saving ? "Saving..." : "Save Bracket"}
                </button>
              )}
            </div>
          )}
        </>
      )}
      {tab === "leaderboard" && <Leaderboard currentUserId={session.user.id} />}
      {tab === "admin" && isAdmin && <AdminPanel onToast={showToast} />}
    </div>
  );
}
