const { clubsById } = require('../data/clubs');

class MatchEngine {
  constructor(options = {}) {
    this.duration = options.duration || 180;
    this.halfTime = this.duration / 2;
    this.tickMs = options.tickMs || 1000;
    this.interval = null;

    this.homeClub = options.homeClub || this.getDefaultClub('england');
    this.awayClub = options.awayClub || this.getDefaultClub('england', this.homeClub.id);

    this.homeTeam = this.homeClub.name;
    this.awayTeam = this.awayClub.name;

    this.players = this.createPlayers();
    this.state = {
      status: 'not_started',
      period: 'first_half',
      clock: 0,
      displayClock: '00:00',
      score: { home: 0, away: 0 },
      homeTeam: this.homeTeam,
      awayTeam: this.awayTeam,
      homeLogo: this.homeClub.logo,
      awayLogo: this.awayClub.logo,
      players: this.players,
      ball: { x: 50, y: 50, holder: null },
      commentary: [],
      goal: null
    };
  }

  getDefaultClub(leagueId, excludeId = null) {
    const clubs = Object.values(clubsById).filter(c => c.leagueId === leagueId);
    return clubs.find(c => c.id !== excludeId) || clubs[0];
  }

  createPlayers() {
    const makeTeam = (club, side) => {
      const squad = club.squad || [];
      const starting = squad.slice(0, 11);
      const formation = [
        [7, 50],
        [18, 25], [18, 42], [18, 58], [18, 75],
        [38, 25], [38, 45], [38, 65],
        [62, 30], [62, 55], [78, 50]
      ];

      return starting.map((player, index) => {
        const [homeX, y] = formation[index];
        const x = side === 'home' ? homeX : 100 - homeX;
        return {
          id: `${side}-${player.id}`,
          clubId: club.id,
          name: player.name,
          number: player.number,
          position: player.position,
          rating: player.rating,
          team: club.name,
          side,
          x,
          y,
          targetX: x,
          targetY: y
        };
      });
    };

    return [...makeTeam(this.homeClub, 'home'), ...makeTeam(this.awayClub, 'away')];
  }

  start() {
    if (this.state.status === 'finished' || this.interval) return;
    this.state.status = 'running';
    this.addCommentary(`KICK OFF — ${this.homeTeam} vs ${this.awayTeam}`);
    this.assignPossession(this.getPlayerBySide('home'));
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
      this.addCommentary(`FULL TIME — ${this.homeTeam} ${this.state.score.home} - ${this.state.score.away} ${this.awayTeam}`);
      this.stop();
      return;
    }

    this.state.clock += 1;
    this.state.displayClock = this.getDisplayClock();

    if (this.state.clock < this.halfTime) {
      this.state.period = 'first_half';
    } else if (this.state.clock === this.halfTime) {
      this.state.period = 'half_time';
      this.addCommentary('HALF TIME');
      return;
    } else {
      this.state.period = 'second_half';
    }

    this.state.goal = null;
    this.movePlayers();
    this.simulatePossessionAndBall();
    this.simulateEvent();
  }

  getDisplayClock() {
    const footballSeconds = Math.min(90 * 60, this.state.clock * 30);
    const minutes = Math.floor(footballSeconds / 60);
    const seconds = footballSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  movePlayers() {
    const holder = this.getHolder();

    for (const player of this.players) {
      const isHolder = holder && player.id === holder.id;
      const homeDirection = player.side === 'home' ? 1 : -1;
      const attackingBias = isHolder ? 2.8 * homeDirection : 0.7 * homeDirection;

      const randomX = (Math.random() - 0.5) * (isHolder ? 5 : 2.5);
      const randomY = (Math.random() - 0.5) * (isHolder ? 5 : 2.5);

      player.targetX = Math.max(3, Math.min(97, player.targetX + randomX + attackingBias));
      player.targetY = Math.max(5, Math.min(95, player.targetY + randomY));

      player.x += (player.targetX - player.x) * 0.55;
      player.y += (player.targetY - player.y) * 0.55;
    }
  }

  simulatePossessionAndBall() {
    let holder = this.getHolder();
    const pressure = Math.random();

    if (!holder || pressure < 0.18) {
      const sameTeam = holder
        ? this.players.filter(p => p.side === holder.side)
        : this.players.filter(p => p.side === 'home');
      const receiver = sameTeam[Math.floor(Math.random() * sameTeam.length)];

      if (receiver) {
        if (holder && holder.id !== receiver.id) {
          this.addCommentary(`${holder.name} passes to ${receiver.name}`);
        }
        holder = receiver;
        this.assignPossession(holder);
      }
    }

    if (holder) {
      this.state.ball.x = Math.max(2, Math.min(98, holder.x));
      this.state.ball.y = Math.max(3, Math.min(97, holder.y));
    }
  }

  simulateEvent() {
    const chance = Math.random();
    const holder = this.getHolder();
    if (!holder) return;

    if (chance < 0.025) {
      this.attemptGoal(holder);
    } else if (chance < 0.075) {
      this.addCommentary(`${holder.name} drives forward for ${holder.team}`);
    } else if (chance < 0.11) {
      this.addCommentary(`${holder.name} attempts a shot`);
    } else if (chance < 0.16) {
      this.addCommentary(`${holder.name} is looking for a teammate`);
    }
  }

  attemptGoal(shooter) {
    const attackStrength = shooter.rating + Math.random() * 30;
    const goalkeeper = this.players.find(p => p.side !== shooter.side && p.position === 'GK');
    const keeperStrength = goalkeeper ? goalkeeper.rating + Math.random() * 30 : 75;

    this.addCommentary(`${shooter.name} shoots from ${this.state.displayClock}`);

    if (attackStrength > keeperStrength + 8) {
      this.scoreGoal(shooter);
    } else {
      this.addCommentary(`${goalkeeper ? goalkeeper.name : 'The goalkeeper'} makes the save`);
      this.state.ball.x = goalkeeper ? goalkeeper.x : (shooter.side === 'home' ? 93 : 7);
      this.state.ball.y = goalkeeper ? goalkeeper.y : 50;
    }
  }

  scoreGoal(scorer) {
    const side = scorer.side;
    const team = side === 'home' ? this.homeTeam : this.awayTeam;

    this.state.score[side] += 1;
    this.state.ball.x = side === 'home' ? 96 : 4;
    this.state.ball.y = 50;

    this.state.goal = {
      team,
      scorer: scorer.name,
      score: `${this.state.score.home} - ${this.state.score.away}`,
      clock: this.state.displayClock,
      description: `${scorer.name} scores for ${team} after a virtual attacking move.`
    };

    this.addCommentary(`GOAL! ${team} — ${scorer.name} scores. ${this.state.score.home} - ${this.state.score.away}`);
  }

  assignPossession(player) {
    if (!player) return;
    this.state.ball.holder = player.id;
    this.state.ball.x = player.x;
    this.state.ball.y = player.y;
  }

  getHolder() {
    return this.players.find(p => p.id === this.state.ball.holder) || null;
  }

  getPlayerBySide(side) {
    return this.players.find(p => p.side === side && p.position !== 'GK') || this.players.find(p => p.side === side);
  }

  addCommentary(text) {
    this.state.commentary.unshift({
      text,
      time: this.state.displayClock
    });
    this.state.commentary = this.state.commentary.slice(0, 30);
  }

  getState() {
    return this.state;
  }
}

module.exports = MatchEngine;
