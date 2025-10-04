// Quick script to compute weekly luck per roster from Sleeper matchups for current season
const fetch = (...args) => import('node-fetch').then(({default:fetch})=>fetch(...args));

(async () => {
  const leagueId = '1181984921049018368';
  const nflStateResp = await fetch('https://api.sleeper.app/v1/state/nfl');
  const nflState = await nflStateResp.json();
  const season = nflState.season;
  console.log('NFL State season/week:', season, nflState.week);

  // fetch rosters
  const rostersResp = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  const rosters = await rostersResp.json();
  const rosterIds = rosters.map(r=>String(r.roster_id));
  console.log('Roster count:', rosterIds.length);

  // fetch matchups for weeks 1..currentWeek
  const currentWeek = nflState.week;
  const weeklyPoints = {};
  rosterIds.forEach(rid=> weeklyPoints[rid] = {});

  for (let w=1; w<=currentWeek; w++){
    const resp = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${w}`);
    const matchups = await resp.json();
    matchups.forEach(m=>{
      const t1 = String(m.team1_roster_id);
      const t2 = String(m.team2_roster_id);
      const s1 = Number(m.team1_score || 0);
      const s2 = Number(m.team2_score || 0);
      if (t1 && rosterIds.includes(t1)) weeklyPoints[t1][w] = s1;
      if (t2 && rosterIds.includes(t2)) weeklyPoints[t2][w] = s2;
    });
  }

  // compute per-week win rates (how many teams each beat) -> luck: expected - actual
  const weeklyLuck = {}; // rosterId -> array of luck per week (1-indexed)
  rosterIds.forEach(rid => weeklyLuck[rid]=[]);

  for (let w=1; w<=currentWeek; w++){
    const scores = rosterIds.map(rid=>({rid, pts: weeklyPoints[rid][w] ?? 0}));
    scores.forEach(s => {
      let beats=0, ties=0, loses=0;
      scores.forEach(o=>{
        if (o.rid===s.rid) return;
        if (s.pts>o.pts) beats++;
        else if (s.pts===o.pts) ties++;
        else loses++;
      });
      // expected wins = beats + ties*0.5
      const expected = beats + ties*0.5;
      const luck = expected - ((scores.length-1)/2); // relative to average
      weeklyLuck[s.rid].push(luck);
    });
  }

  // sample output
  const sample = Object.keys(weeklyLuck).slice(0,5).map(rid=>({rid, luck: weeklyLuck[rid]}));
  console.log('Sample weeklyLuck for first 5 rosters:', sample);
  // check if any non-zero
  const anyNonZero = Object.values(weeklyLuck).some(a=>a.some(v=>v!==0));
  console.log('Any non-zero luck?', anyNonZero);
})();
