class MatchEngine {
  constructor(options = {}) {
    this.duration = 180; // Internal simulation: 3 minutes.
    this.halfTime = 90; // Internal 90 seconds = displayed 45:00.
    this.tickMs = options.tickMs || 1000;
    this.interval = null;

    this.homeTeam = options.homeTeam || 'Manchester City';
    this.awayTeam = options.awayTeam || 'Arsenal';

    this.players = this.createPlayers();

    this.state = {
      status: 'not_started',
      period: 'first_half',
      clock: 0,
      displayClock: '00:00',
      score: { home: 0, away: 0 },
      ball: { x: 50, y: 50, holder: null },
      players: this.players,
      commentary: [],
      goal: null
    };
  }

  createPlayers() {
    const makeTeam = (team, side) => {
      const names = side === 'home'
        ? ['Ederson', 'Walker', 'Dias', 'Gvardiol', 'Rodri', 'De Bruyne', 'Foden', 'Doku', 'Haaland', 'Grealish', 'Bernardo']
        : ['Raya', 'White', 'Saliba', 'Gabriel', 'Timber', 'Odegaard', 'Rice', 'Saka', 'Martinelli', 'Havertz', 'Jesus'];

      return names.map((name, index) => ({
        id: `${side}-${index + 1}`,
        name,
        team,
        x: side === 'home' ? 15 + (index % 6) * 11 : 45 + (index % 6) * 9,
        y: 12 + Math.floor(index / 6) * 38,
        role: index === 8 ? 'forward' : index === 0 ? 'goalkeeper' : 'player'
      }));
    };

    return [...makeTeam(this.homeTeam, 'home'), ...makeTeam(this.awayTeam, 'away')];
  }

  start() {
    if (this.state.status === 'finished') return;
    if (this.interval) return;

    this.state.status = 'running';
    this.addCommentary(`Match started: ${this.homeTeam} vs ${this.awayTeam}`);

    this.interval = setInterval(() => this.tick(), this.tickMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  tick() {
    if (this.state.clock >= this.duration) {
      this.state.status = 'finished';
      this.state.period = 'full_time';
      this.state.displayClock = '90:00';
      this.state.goal = null;
      this.addCommentary(`FULL TIME: ${this.homeTeam} ${this.state.score.home} - ${this.state.score.away} ${this.awayTeam}`);
      this.stop();
      return;
    }

    this.state.clock += 1;

    if (this.state.clock < this.halfTime) {
      this.state.period = 'first_half';
    } else if (this.state.clock === this.halfTime) {
      this.state.period = 'half_time';
      this.addCommentary('HALF TIME');
    } else {
      this.state.period = 'second_half';
    }

    this.state.displayClock = this.getDisplayClock();
    this.state.goal = null;

    if (this.state.period !== 'half_time') {
      this.movePlayers();
      this.moveBall();
      this.simulateEvent();
    }
  }

  getDisplayClock() {
    // 180 internal seconds are mapped to a normal 90-minute football clock.
    const footballSeconds = Math.min(90 * 60, this.state.clock * 30);
    const minutes = Math.floor(footballSeconds / 60);
    const seconds = footballSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  movePlayers() {
    for (const player of this.players) {
      const dx = (Math.random() - 0.5) * 4;
      const dy = (Math.random() - 0.5) * 4;
      player.x = Math.max(3, Math.min(97, player.x + dx));
      player.y = Math.max(5, Math.min(95, player.y + dy));
    }
  }

  moveBall() {
    let holder = this.players.find((p) => p.id === this.state.ball.holder);

    if (!holder || Math.random() < 0.25) {
      holder = this.players[Math.floor(Math.random() * this.players.length)];
      this.state.ball.holder = holder.id;
      this.addCommentary(`${holder.name} (${holder.team}) has the ball`);
    }

    this.state.ball.x = Math.max(2, Math.min(98, holder.x + (Math.random() - 0.5) * 6));
    this.state.ball.y = Math.max(3, Math.min(97, holder.y + (Math.random() - 0.5) * 6));
  }

  simulateEvent() {
    const chance = Math.random();

    if (chance < 0.018) {
      this.scoreGoal();
    } else if (chance < 0.055) {
      const holder = this.getHolder();
      this.addCommentary(`${holder.name} drives forward for ${holder.team}`);
    } else if (chance < 0.085) {
      const holder = this.getHolder();
      this.addCommentary(`${holder.name} attempts a shot`);
    }
  }

  getHolder() {
    return this.players.find((p) => p.id === this.state.ball.holder) || this.players[0];
  }

  scoreGoal() {
    const holder = this.getHolder();
    const side = holder.team === this.homeTeam ? 'home' : 'away';
    const team = side === 'home' ? this.homeTeam : this.awayTeam;

    this.state.score[side] += 1;
    this.state.ball.x = side === 'home' ? 96 : 4;
    this.state.ball.y = 50;
    this.state.goal = {
      team,
      scorer: holder.name,
      score: `${this.state.score.home} - ${this.state.score.away}`,
      clock: this.state.displayClock,
      description: `${holder.name} finishes the attack and sends the ball into the net.`
    };

    this.addCommentary(`GOAL! ${team} — ${holder.name} scores. ${this.state.score.home} - ${this.state.score.away}`);
  }

  addCommentary(message) {
    this.state.commentary.unshift({
      text: message,
      time: this.state.displayClock
    });
    this.state.commentary = this.state.commentary.slice(0, 20);
  }

  getState() {
    return this.state;
  }
}

module.exports = MatchEngine;
