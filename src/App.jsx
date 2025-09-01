import React, { useMemo, useState } from "react";
import {
  Users,
  Trophy,
  Calendar as CalendarIcon,
  Plus,
  Minus,
  Edit2,
  RotateCcw,
  Star,
  Award,
  Target,
  History,
  ListChecks,
} from "lucide-react";

/**
 * Finding Friends Score Tracker
 * Single-file React component as requested.
 * - Tabs: New Game, Statistics, Details, Past Games
 * - Session data keyed by date string (e.g., Mon Oct 28 2024)
 * - In-memory only (no localStorage), easy to wire up later
 * - Tailwind for styling
 */

function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}

function todayLabel() {
  return new Date().toDateString();
}

function defaultPlayers() {
  return ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6"];
}

const START_BID = 150;
const NO_BIDS_VALUE = 160;

export default function FindingFriendsTracker() {
  const [activeTab, setActiveTab] = useState("New Game");
  const [selectedDate, setSelectedDate] = useState(todayLabel());
  const [gameData, setGameData] = useState(() => ({
    [todayLabel()]: {
      players: defaultPlayers(),
      rounds: [],
      currentRound: 1,
    },
  }));

  // --- Helpers to get/update current session ---
  const getCurrent = () => {
    if (!gameData[selectedDate]) {
      // create lazily with default players
      setGameData((prev) => ({
        ...prev,
        [selectedDate]: { players: defaultPlayers(), rounds: [], currentRound: 1 },
      }));
      return { players: defaultPlayers(), rounds: [], currentRound: 1 };
    }
    return gameData[selectedDate];
  };

  const updateCurrent = (updater) => {
    setGameData((prev) => {
      const existing = prev[selectedDate] ?? { players: defaultPlayers(), rounds: [], currentRound: 1 };
      return { ...prev, [selectedDate]: updater(existing) };
    });
  };

  // --- Player editing ---
  const onRename = (idx, name) => {
    updateCurrent((s) => {
      const players = [...s.players];
      players[idx] = name || `Player ${idx + 1}`;
      return { ...s, players };
    });
  };

  // --- New Game page state ---
  const [mode, setMode] = useState("Normal"); // Normal | 1v5
  const [host, setHost] = useState(0); // index in players
  const [friends, setFriends] = useState([]); // array of player indexes
  const [bid, setBid] = useState(START_BID);
  const [opponentScore, setOpponentScore] = useState(0);

  const session = getCurrent();
  const { players, rounds, currentRound } = session;

  const friendsAllowed = mode === "Normal" ? 2 : 0;

  const toggleFriend = (i) => {
    if (i === host) return; // host can't be friend
    if (friendsAllowed === 0) return; // not applicable
    setFriends((prev) => {
      const exists = prev.includes(i);
      let next = exists ? prev.filter((x) => x !== i) : [...prev, i];
      if (next.length > friendsAllowed) next = next.slice(0, friendsAllowed);
      return next;
    });
  };

  const resetNewGameForm = () => {
    setMode("Normal");
    setHost(0);
    setFriends([]);
    setBid(START_BID);
    setOpponentScore(0);
  };

  // --- Scoring Logic ---
  function calculateScores({ mode, players, hostIdx, friendIdxs, bid, opponentScore }) {
    const n = players.length; // expected 6
    const scores = Object.fromEntries(players.map((p) => [p, 0]));

    const hostName = players[hostIdx];
    const friendNames = friendIdxs.map((i) => players[i]);
    const teamSet = new Set([hostName, ...friendNames]);

    const opponents = players.filter((p) => !teamSet.has(p));
    const winHostTeam = opponentScore < bid;

    if (mode === "1v5") {
      if (winHostTeam) {
        scores[hostName] = 400;
        return { scores, winner: "Host", distribution: "1v5 host win: +400" };
      } else {
        const each = (opponentScore * 1.5) / 5;
        opponents.forEach((p) => (scores[p] = each));
        return { scores, winner: "Opponents", distribution: `1v5 opponents: each +${each.toFixed(0)}` };
      }
    }

    // Normal mode
    if (winHostTeam) {
      const distributable = 400 - opponentScore;
      if (friendNames.length === 0) {
        scores[hostName] = distributable;
      } else if (friendNames.length === 1) {
        scores[hostName] = Math.round(distributable * 0.75);
        scores[friendNames[0]] = distributable - scores[hostName];
      } else {
        const hostShare = Math.round(distributable * 0.5);
        const friendShare = Math.round((distributable - hostShare) / 2);
        scores[hostName] = hostShare;
        scores[friendNames[0]] = friendShare;
        scores[friendNames[1]] = distributable - hostShare - friendShare;
      }
      return { scores, winner: "Host Team", distribution: `Host team split of ${400 - opponentScore}` };
    } else {
      const each = (opponentScore * 1.5) / opponents.length;
      opponents.forEach((p) => (scores[p] = each));
      return { scores, winner: "Opponents", distribution: `Opponents each +${each.toFixed(0)}` };
    }
  }

  const addRound = () => {
    // Only allow adding on today's date
    if (selectedDate !== todayLabel()) return;

    const friendIdxs = friends.filter((i) => i !== host);
    // quick validation
    if (mode === "Normal" && friendIdxs.length > 2) return;
    if (bid < 80 && bid !== NO_BIDS_VALUE) return;
    if (opponentScore < 0 || opponentScore > 400) return;

    const { scores, winner, distribution } = calculateScores({
      mode,
      players,
      hostIdx: host,
      friendIdxs,
      bid,
      opponentScore,
    });

    updateCurrent((s) => ({
      ...s,
      rounds: [
        ...s.rounds,
        {
          id: `${Date.now()}`,
          round: s.currentRound,
          mode,
          players: [...players],
          host: players[host],
          friends: friendIdxs.map((i) => players[i]),
          bid,
          opponentScore,
          scores,
          winner,
          distribution,
          date: selectedDate,
        },
      ],
      currentRound: s.currentRound + 1,
    }));

    resetNewGameForm();
  };

  // --- Derived stats ---
  const totalsByPlayer = useMemo(() => {
    const map = new Map();
    (rounds || []).forEach((r) => {
      Object.entries(r.scores).forEach(([name, pts]) => {
        map.set(name, (map.get(name) || 0) + pts);
      });
    });
    return Array.from(map.entries())
      .map(([player, total]) => ({ player, total }))
      .sort((a, b) => b.total - a.total);
  }, [rounds]);

  const roleStats = useMemo(() => {
    const rs = players.reduce((acc, p) => {
      acc[p] = { hosted: 0, hostWins: 0, friendGames: 0, friendWins: 0, played: 0 };
      return acc;
    }, {});

    rounds.forEach((r) => {
      const team = new Set([r.host, ...r.friends]);
      r.players.forEach((p) => (rs[p].played += 1));
      rs[r.host].hosted += 1;
      if (r.winner === "Host" || r.winner === "Host Team") {
        rs[r.host].hostWins += 1;
      }
      r.friends.forEach((f) => {
        rs[f].friendGames += 1;
        if (r.winner === "Host" || r.winner === "Host Team") rs[f].friendWins += 1;
      });
    });
    return rs;
  }, [rounds, players]);

  const allDates = Object.keys(gameData).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // --- UI Components ---
  const Tab = ({ icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(label)}
      className={classNames(
        "flex items-center gap-2 px-4 py-2 rounded-2xl transition shadow-sm",
        activeTab === label
          ? "bg-indigo-600 text-white"
          : "bg-white/80 backdrop-blur hover:bg-white"
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </button>
  );

  const Pill = ({ children }) => (
    <span className="px-2 py-1 rounded-full text-xs bg-slate-100 border border-slate-200">{children}</span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6" /> Finding Friends Score Tracker
            </h1>
            <p className="text-slate-600 text-sm mt-1">Track scores, stats & history for Zhao Pengyou.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-sm border">
              <CalendarIcon className="w-4 h-4 text-slate-500" />
              <select
                className="outline-none bg-transparent text-sm"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {allDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                className="text-xs px-2 py-1 rounded-full border hover:bg-slate-50"
                onClick={() => setSelectedDate(todayLabel())}
                title="Jump to today"
              >
                Today
              </button>
            </div>

            <div className="flex gap-2">
              <Tab icon={ListChecks} label="New Game" />
              <Tab icon={Trophy} label="Statistics" />
              <Tab icon={History} label="Details" />
              <Tab icon={Award} label="Past Games" />
            </div>
          </div>
        </header>

        {/* Players editor */}
        <section className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Players</h2>
            <div className="text-xs text-slate-500">Edit names inline (6 players)</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2">
                <Edit2 className="w-4 h-4 text-slate-500" />
                <input
                  className="bg-transparent outline-none flex-1 text-sm"
                  value={p}
                  onChange={(e) => onRename(i, e.target.value)}
                />
                <Pill>#{i + 1}</Pill>
              </div>
            ))}
          </div>
        </section>

        {/* Tabs content */}
        {activeTab === "New Game" && (
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4" /> New Round</h2>
              <div className="text-xs">
                {selectedDate !== todayLabel() ? (
                  <span className="text-rose-600 font-medium">Adding rounds is locked for non-today sessions.</span>
                ) : (
                  <span className="text-slate-500">Round #{currentRound}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: mode/host/friends */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Game Mode</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value);
                      setFriends([]);
                    }}
                  >
                    <option value="Normal">Normal</option>
                    <option value="1v5">1v5</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Host</label>
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={host}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setHost(v);
                      setFriends((prev) => prev.filter((i) => i !== v));
                    }}
                  >
                    {players.map((p, i) => (
                      <option key={i} value={i}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Friends {mode === "Normal" ? `(${friends.length}/${friendsAllowed})` : "(—)"}</label>
                    {mode === "Normal" && <span className="text-xs text-slate-500">Select up to 2 (not host)</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {players.map((p, i) => (
                      <button
                        key={i}
                        disabled={i === host || friendsAllowed === 0}
                        onClick={() => toggleFriend(i)}
                        className={classNames(
                          "px-3 py-2 rounded-xl border text-sm",
                          i === host || friendsAllowed === 0
                            ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                            : friends.includes(i)
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white hover:bg-slate-50"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle: bidding */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Bid</label>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      className="p-2 rounded-xl border hover:bg-slate-50"
                      onClick={() => setBid((b) => (b === NO_BIDS_VALUE ? START_BID : Math.max(START_BID, b - 5)))}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 text-center text-lg font-semibold">{bid}</div>
                    <button
                      className="p-2 rounded-xl border hover:bg-slate-50"
                      onClick={() => setBid((b) => (b === NO_BIDS_VALUE ? START_BID + 5 : b + 5))}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                      onClick={() => setBid(NO_BIDS_VALUE)}
                    >
                      No Bids
                    </button>
                    <button
                      className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                      onClick={() => setBid(START_BID)}
                    >
                      Reset
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Minimum 80, step 5. "No Bids" = 160.</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Opponent Score</label>
                  <input
                    type="number"
                    min={0}
                    max={400}
                    className="mt-1 w-full border rounded-xl px-3 py-2"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(parseInt(e.target.value || "0", 10))}
                  />
                  <p className="text-xs text-slate-500 mt-1">0–400. Host team wins if Opponent &lt; Bid.</p>
                </div>
              </div>

              {/* Right: actions & preview */}
              <div className="space-y-4">
                <div className="bg-slate-50 border rounded-2xl p-3">
                  <div className="text-sm font-medium mb-2">Summary</div>
                  <ul className="text-sm space-y-1">
                    <li>Mode: <b>{mode}</b></li>
                    <li>Host: <b>{players[host]}</b></li>
                    <li>
                      Friends: {mode === "Normal" ? (
                        friends.length ? friends.map((i) => players[i]).join(", ") : <span className="text-slate-500">None</span>
                      ) : (
                        <span className="text-slate-500">Not applicable</span>
                      )}
                    </li>
                    <li>Bid: <b>{bid}</b></li>
                    <li>Opponent Score: <b>{opponentScore}</b></li>
                  </ul>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={selectedDate !== todayLabel()}
                    onClick={addRound}
                    className={classNames(
                      "flex-1 px-4 py-2 rounded-2xl text-white font-medium shadow",
                      selectedDate === todayLabel() ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"
                    )}
                  >
                    Add Game & Calculate Scores
                  </button>
                  <button
                    onClick={resetNewGameForm}
                    className="px-3 py-2 rounded-2xl border bg-white hover:bg-slate-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Statistics" && (
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="w-4 h-4" /> Leaderboard & Stats</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-2xl p-3">
                <h3 className="font-medium mb-2">Leaderboard (This Session)</h3>
                <ul className="divide-y">
                  {totalsByPlayer.map((row, i) => (
                    <li key={row.player} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className={classNames(
                          "w-6 h-6 rounded-full text-xs grid place-items-center",
                          i === 0 ? "bg-amber-100" : i === 1 ? "bg-slate-100" : i === 2 ? "bg-orange-100" : "bg-slate-50"
                        )}>{i + 1}</span>
                        <span>{row.player}</span>
                      </div>
                      <div className="font-semibold">{Math.round(row.total)}</div>
                    </li>
                  ))}
                  {totalsByPlayer.length === 0 && (
                    <li className="py-4 text-slate-500 text-sm">No rounds yet.</li>
                  )}
                </ul>
              </div>

              <div className="border rounded-2xl p-3">
                <h3 className="font-medium mb-2">Player Performance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {players.map((p) => {
                    const rs = roleStats[p];
                    const hostWR = rs.hosted ? Math.round((rs.hostWins / rs.hosted) * 100) : 0;
                    const friendWR = rs.friendGames ? Math.round((rs.friendWins / rs.friendGames) * 100) : 0;
                    const total = totalsByPlayer.find((r) => r.player === p)?.total || 0;
                    return (
                      <div key={p} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium flex items-center gap-2"><Star className="w-4 h-4" /> {p}</div>
                          <Pill>{Math.round(total)} pts</Pill>
                        </div>
                        <div className="text-xs text-slate-600 grid grid-cols-2 gap-1">
                          <div>Hosted: <b>{rs.hosted}</b></div>
                          <div>Host WR: <b>{hostWR}%</b></div>
                          <div>Friend Gms: <b>{rs.friendGames}</b></div>
                          <div>Friend WR: <b>{friendWR}%</b></div>
                          <div>Played: <b>{rs.played}</b></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "Details" && (
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><History className="w-4 h-4" /> Round History ({selectedDate})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Mode</th>
                    <th className="text-left p-2">Host</th>
                    <th className="text-left p-2">Friends</th>
                    <th className="text-left p-2">Bid</th>
                    <th className="text-left p-2">Opp Score</th>
                    <th className="text-left p-2">Winner</th>
                    <th className="text-left p-2">Distribution</th>
                    <th className="text-left p-2">Scores</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{r.round}</td>
                      <td className="p-2">{r.mode}</td>
                      <td className="p-2">{r.host}</td>
                      <td className="p-2">{r.friends.join(", ") || "—"}</td>
                      <td className="p-2">{r.bid}</td>
                      <td className="p-2">{r.opponentScore}</td>
                      <td className="p-2">{r.winner}</td>
                      <td className="p-2">{r.distribution}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(r.scores).map(([name, pts]) => (
                            <span key={name} className="px-2 py-1 rounded-full bg-slate-100 border text-xs">
                              {name}: <b>{Math.round(pts)}</b>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rounds.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-500">No rounds yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "Past Games" && (
          <section className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Award className="w-4 h-4" /> Past Games & All-time</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 border rounded-2xl p-3">
                <h3 className="font-medium mb-2 flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Sessions</h3>
                <ul className="divide-y">
                  {allDates.map((d) => {
                    const s = gameData[d];
                    const totals = (() => {
                      const map = new Map();
                      s.rounds.forEach((r) => {
                        Object.entries(r.scores).forEach(([name, pts]) => {
                          map.set(name, (map.get(name) || 0) + pts);
                        });
                      });
                      return Array.from(map.entries())
                        .map(([player, total]) => ({ player, total }))
                        .sort((a, b) => b.total - a.total);
                    })();
                    return (
                      <li key={d} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{d}</div>
                          <div className="text-xs text-slate-600">Rounds: {s.rounds.length}</div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {totals.slice(0, 3).map((t, i) => (
                            <Pill key={i}>{t.player}: {Math.round(t.total)}</Pill>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border rounded-2xl p-3">
                <h3 className="font-medium mb-2 flex items-center gap-2"><Trophy className="w-4 h-4" /> All-time Top</h3>
                {(() => {
                  const map = new Map();
                  Object.values(gameData).forEach((s) => {
                    s.rounds.forEach((r) => {
                      Object.entries(r.scores).forEach(([name, pts]) => {
                        map.set(name, (map.get(name) || 0) + pts);
                      });
                    });
                  });
                  const rows = Array.from(map.entries())
                    .map(([player, total]) => ({ player, total }))
                    .sort((a, b) => b.total - a.total);
                  return rows.length ? (
                    <ul className="space-y-2">
                      {rows.map((r, i) => (
                        <li key={r.player} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={classNames(
                              "w-6 h-6 rounded-full text-xs grid place-items-center",
                              i === 0 ? "bg-amber-100" : i === 1 ? "bg-slate-100" : i === 2 ? "bg-orange-100" : "bg-slate-50"
                            )}>{i + 1}</span>
                            <span>{r.player}</span>
                          </div>
                          <b>{Math.round(r.total)}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">No data yet.</div>
                  );
                })()}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
