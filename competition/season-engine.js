const MatchEngine = require('../match/match-engine');
const { clubs } = require('../data/clubs');

function makeRoundRobin(clubList) {
  const teams = [...clubList];
  if (teams.length % 2) teams.push(null);
  const rounds = teams.length - 1;
  const half = teams.length / 2;
  const schedule = [];
  let rotation = [...teams];

  for (let round = 0; round < rounds; round += 1) {
    const fixtures = [];
    for (let i = 0; i < half; i += 1) {
      const a = rotation[i];
      const b = rotation[rotation.length - 1 - i];
      if (!a || !b) continue;
      fixtures.push({
        id: `W${round + 1}-${fixtures.length + 1}`,
        week: round + 1,
        home: round % 2 === 0 ? a : b,
        away: round % 2 === 0 ? b : a
      });
    }
    schedule.push(fixtures);
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
  return schedule;
}

class SeasonEngine {
  constructor(options = {}) {
    this.leagueId = options.leagueId || 'england';
    this.week = options.week || 1;
    this.fixtures = makeRoundRobin(clubs.filter(c => c.leagueId === this.leagueId));
    this.matches = [];
    this.status = 'scheduled';
    this.standings = this.createStandings();
    this.poller = null;
  }

  createStandings() {
    const table = {};
    clubs.filter(c => c.leagueId === this.leagueId).forEach(club => {
      table[club.id] = { clubId: club.id, club: club.name, logo: club.logo, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
    });
    return table;
  }

  getWeekFixtures(week = this.week) { return this.fixtures[week - 1] || []; }

  startWeek(week = this.week) {
    if (this.status === 'running') return;
    const fixtures = this.getWeekFixtures(week);
    if (!fixtures.length) return;
    this.week = week;
    this.matches = fixtures.map(fixture => ({ fixture, engine: new MatchEngine({ homeClub: fixture.home, awayClub: fixture.away }) }));
    this.status = 'running';
    this.matches.forEach(item => item.engine.start());
    if (!this.poller) this.poller = setInterval(() => this.checkWeek(), 1000);
  }

  checkWeek() {
    if (this.status !== 'running') return;
    if (!this.matches.every(item => item.engine.getState().status === 'finished')) return;
    this.matches.forEach(item => this.applyResult(item.engine.getState()));
    this.status = 'week_complete';
  }

  findStanding(teamName) {
    return Object.values(this.standings).find(row => row.club === teamName);
  }

  applyResult(state) {
    if (state._counted) return;
    const home = this.findStanding(state.homeTeam);
    const away = this.findStanding(state.awayTeam);
    if (!home || !away) return;
    const hg = state.score.home;
    const ag = state.score.away;
    home.played += 1; away.played += 1;
    home.gf += hg; home.ga += ag; away.gf += ag; away.ga += hg;
    if (hg > ag) { home.won += 1; home.points += 3; away.lost += 1; }
    else if (hg < ag) { away.won += 1; away.points += 3; home.lost += 1; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
    state._counted = true;
  }

  standingsList() {
    return Object.values(this.standings).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.club.localeCompare(b.club));
  }

  weekState() {
    return {
      league: this.leagueId,
      week: this.week,
      status: this.status,
      matches: this.matches.map(({ fixture, engine }) => {
        const state = engine.getState();
        return { id: fixture.id, home: state.homeTeam, away: state.awayTeam, homeLogo: state.homeLogo, awayLogo: state.awayLogo, score: state.score, status: state.status, clock: state.displayClock };
      }),
      standings: this.standingsList(),
      nextWeek: this.week < this.fixtures.length ? this.week + 1 : null
    };
  }

  selectedState(index = 0) {
    const item = this.matches[index] || this.matches[0];
    return item ? item.engine.getState() : null;
  }
}

module.exports = { SeasonEngine, makeRoundRobin };
