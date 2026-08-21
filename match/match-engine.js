const { clubsById } = require('../data/clubs');

class MatchEngine {
  constructor(options = {}) {
    this.duration = options.duration || 180;
    this.halfTime = this.duration / 2;
    this.tickMs = options.tickMs || 1000;
    this.interval = null;
    this.goalResetTicks = 0;
    this.kickoffSide = 'home';

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
      ball: { x: 50, y: 50, holder: null, action: 'stationary' },
      commentary: [],
      goal: null
    };
  }

  getDefaultClub(leagueId, excludeId = null) {
    const clubs = Object.values(clubsById).filter(c => c.leagueId === leagueId);
    return clubs.find(c => c.id !== excludeId) || clubs[0];
  }

  normalizeRole(position) {
    const value = String(position || '').toUpperCase();
    if (value.includes('GK') || value.includes('GOALKEEP')) return 'GK';
    if (value.includes('DEF') || value.includes('BACK')) return 'DEF';
    if (value.includes('MID')) return 'MID';
    if (value.includes('FWD') || value.includes('FORWARD') || value.includes('ST') || value.includes('CF') || value.includes('WING')) return 'FWD';
    return 'MID';
  }

  createPlayers() {
    const formation = [
      { role: 'GK', x: 6, y: 50 },
      { role: 'DEF', x: 18, y: 18 },
      { role: 'DEF', x: 16, y: 40 },
      { role: 'DEF', x: 16, y: 60 },
      { role: 'DEF', x: 18, y: 82 },
      { role: 'MID', x: 34, y: 20 },
      { role: 'MID', x: 38, y: 45 },
      { role: 'MID', x: 34, y: 75 },
      { role: 'FWD', x: 58, y: 25 },
      { role: 'FWD', x: 64, y: 50 },
      { role: 'FWD', x: 58, y: 75 }
    ];

    const makeTeam = (club, side) => {
      const starting = (club.squad || []).slice(0, 11);

      return starting.map((player, index) => {
        const tactical = formation[index];
        const x = side === 'home' ? tactical.x : 100 - tactical.x;
        const role = this.normalizeRole(player.position);

        return {
          id: `${side}-${player.id}`,
          clubId: club.id,
          name: player.name,
          number: player.number,
          position: player.position,
          role,
          rating: player.rating,
          team: club.name,
          side,
          x,
          y: tactical.y,
          baseX: x,
          baseY: tactical.y,
          targetX: x,
          targetY: tactical.y,
          dribbling: false,
          attacking: false,
          hasBall: false,
          stamina: 100,
          seed: Math.random() * 100,
          nextDecision: 0
        };
      });
    };

    return [
      ...makeTeam(this.homeClub, 'home'),
      ...makeTeam(this.awayClub, 'away')
    ];
  }

  start() {
    if (this.state.status === 'finished' || this.interval) return;

    this.state.status = 'running';
    this.addCommentary(`KICK OFF — ${this.homeTeam} vs ${this.awayTeam}`);
    this.prepareKickoff('home');
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
      this.resetPlayersToShape();
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
      this.resetAfterHalf();
      return;
    } else {
      this.state.period = 'second_half';
    }

    this.state.goal = null;

    if (this.goalResetTicks > 0) {
      this.goalResetTicks -= 1;
      this.movePlayersForRestart();
      if (this.goalResetTicks === 0) this.prepareKickoff(this.kickoffSide);
      return;
    }

    this.movePlayersLikeFootball();
    this.simulatePossessionAndBall();
    this.simulateEvent();
    this.updateBallFromHolder();
  }

  getDisplayClock() {
    const footballSeconds = Math.min(90 * 60, this.state.clock * 30);
    const minutes = Math.floor(footballSeconds / 60);
    const seconds = footballSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  getAttackDirection(side) {
    return side === 'home' ? 1 : -1;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  moveTowards(player, targetX, targetY, speed = 0.3) {
    const x = this.clamp(targetX, 2, 98);
    const y = this.clamp(targetY, 4, 96);
    player.targetX = x;
    player.targetY = y;
    player.x += (x - player.x) * speed;
    player.y += (y - player.y) * speed;
  }

  getNearestOpponent(player) {
    let nearest = null;
    let distance = Infinity;
    for (const other of this.players) {
      if (other.side === player.side) continue;
      const d = Math.hypot(other.x - player.x, other.y - player.y);
      if (d < distance) {
        distance = d;
        nearest = other;
      }
    }
    return { player: nearest, distance };
  }

  getTeamPlayers(side) {
    return this.players.filter(p => p.side === side);
  }

  getHolder() {
    return this.players.find(p => p.id === this.state.ball.holder) || null;
  }

  getGoalX(side) {
    return side === 'home' ? 98 : 2;
  }

  getPlayerBySide(side) {
    return this.players.find(p => p.side === side && p.role === 'MID')
      || this.players.find(p => p.side === side && p.role === 'FWD')
      || this.players.find(p => p.side === side && p.role === 'DEF')
      || this.players.find(p => p.side === side);
  }

  getRoleWeight(role) {
    if (role === 'FWD') return 1.0;
    if (role === 'MID') return 0.9;
    if (role === 'DEF') return 0.7;
    return 0.3;
  }

  movePlayersLikeFootball() {
    const holder = this.getHolder();
    const ballX = this.state.ball.x;
    const ballY = this.state.ball.y;

    for (const player of this.players) {
      const direction = this.getAttackDirection(player.side);
      const ownGoal = player.side === 'home' ? 0 : 100;
      const opponentGoal = this.getGoalX(player.side);
      const sameTeamHasBall = holder && holder.side === player.side;
      const opponentHasBall = holder && holder.side !== player.side;
      const isHolder = holder && holder.id === player.id;

      player.dribbling = false;
      player.attacking = false;
      player.hasBall = Boolean(isHolder);

      if (player.role === 'GK') {
        // The keeper can leave the goal area to collect a loose ball, but never wanders randomly.
        const ballInDanger = Math.abs(ballX - ownGoal) < 18;
        const targetX = ballInDanger && !holder
          ? this.clamp(ballX, player.side === 'home' ? 5 : 78, player.side === 'home' ? 22 : 95)
          : (player.side === 'home' ? 6 : 94);
        const targetY = this.clamp(50 + (ballY - 50) * 0.35, 35, 65);
        this.moveTowards(player, targetX, targetY, 0.25);
        continue;
      }

      // Every player has an individual target. The ball and opponents influence it,
      // but the player keeps his own movement rhythm so the two teams never mirror each other.
      let targetX = player.baseX;
      let targetY = player.baseY;
      const timeWave = Math.sin((this.state.clock + player.seed) * 0.17);
      const laneWave = Math.cos((this.state.clock * 0.13) + player.seed);

      // Team shape stretches toward the ball. It is not a hard zone: players are
      // allowed to cross midfield and enter the opponent penalty area during attacks.
      const ballPull = sameTeamHasBall ? 0.42 : opponentHasBall ? 0.26 : 0.16;
      targetX += (ballX - targetX) * ballPull;
      targetY += (ballY - targetY) * ballPull;

      // Individual role tendencies, not fixed walls.
      if (player.role === 'FWD') {
        targetX += direction * (sameTeamHasBall ? 8 : 2) * (0.7 + Math.random() * 0.5);
        targetY += laneWave * 8;
        if (sameTeamHasBall) player.attacking = true;
      } else if (player.role === 'MID') {
        targetX += direction * (sameTeamHasBall ? 5 : 0);
        targetY += laneWave * 6;
        if (sameTeamHasBall) player.attacking = true;
      } else if (player.role === 'DEF') {
        targetX += direction * (sameTeamHasBall ? 4 : -2);
        targetY += laneWave * 4;
        if (sameTeamHasBall && Math.random() < 0.22) player.attacking = true;
      }

      // When defending, defenders and midfielders naturally track the dangerous side
      // of the attack instead of standing at the back.
      if (opponentHasBall) {
        const danger = Math.abs(ballX - player.x) < 35 ? 1 : 0.35;
        targetX += (ballX - targetX) * 0.18 * danger;
        targetY += (ballY - targetY) * 0.22 * danger;
      }

      // Give players independent off-ball movement so every player has his own life.
      targetX += direction * timeWave * 2.5;
      targetY += laneWave * 2.5;

      if (isHolder) {
        if (player.role === 'FWD') {
          // A forward carries the ball into open space and can run into the box.
          player.dribbling = true;
          targetX = player.x + direction * (4.5 + Math.random() * 3.5);
          targetY = player.y + (Math.random() - 0.5) * 9;
        } else if (player.role === 'MID') {
          targetX = player.x + direction * (2.5 + Math.random() * 2.5);
          targetY = player.y + (Math.random() - 0.5) * 7;
        } else {
          targetX = player.x + direction * (1.5 + Math.random() * 2);
          targetY = player.y + (Math.random() - 0.5) * 5;
        }
      }

      // If the ball is close to the opponent goal, attackers make runs into the box.
      if (sameTeamHasBall && Math.abs(opponentGoal - ballX) < 28) {
        if (player.role === 'FWD') {
          targetX = opponentGoal - direction * (5 + Math.random() * 8);
          targetY += (Math.random() - 0.5) * 12;
        } else if (player.role === 'MID') {
          targetX += direction * 8;
        }
      }

      // Defenders can follow an attacking play all the way upfield when the match demands it.
      // They are not locked to the defensive third.
      if (sameTeamHasBall && player.role === 'DEF' && Math.abs(opponentGoal - ballX) < 22 && Math.random() < 0.15) {
        targetX = opponentGoal - direction * (15 + Math.random() * 12);
        targetY += (Math.random() - 0.5) * 15;
      }

      const speed = isHolder ? 0.48 : 0.22 + (player.rating || 70) / 1000;
      this.moveTowards(player, targetX, targetY, speed);
    }
  }

  getPassTargets(holder) {
    if (!holder) return [];

    const teammates = this.getTeamPlayers(holder.side).filter(p => p.id !== holder.id && p.role !== 'GK');
    const direction = this.getAttackDirection(holder.side);

    return teammates
      .map(player => {
        const forwardProgress = (player.x - holder.x) * direction;
        const distance = Math.hypot(player.x - holder.x, player.y - holder.y);
        let score = 50 - distance;

        if (holder.role === 'DEF' && player.role === 'MID') score += 18;
        if (holder.role === 'MID' && player.role === 'FWD') score += 20;
        if (holder.role === 'FWD' && player.role === 'FWD') score += 8;
        if (forwardProgress > 0) score += Math.min(18, forwardProgress * 0.7);
        if (player.role === 'DEF' && holder.role === 'FWD') score -= 4;

        return { player, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.player);
  }

  passTo(holder, receiver) {
    if (!holder || !receiver) return;

    this.state.ball.action = 'pass';
    this.state.ball.holder = receiver.id;
    this.state.ball.x = receiver.x;
    this.state.ball.y = receiver.y;
    this.addCommentary(`${holder.name} passes to ${receiver.name}`);
  }

  simulatePossessionAndBall() {
    let holder = this.getHolder();

    if (!holder) {
      const restart = this.getPlayerBySide(this.kickoffSide);
      if (restart) this.assignPossession(restart);
      return;
    }

    const nearestOpponent = this.getNearestOpponent(holder);
    const pressure = nearestOpponent.distance < 13;
    const passTargets = this.getPassTargets(holder);

    // A pressured player is much more likely to release the ball.
    const passChance = pressure ? 0.42 : (holder.role === 'FWD' ? 0.20 : 0.27);

    if (passTargets.length && Math.random() < passChance) {
      const receiver = passTargets[Math.floor(Math.random() * Math.min(3, passTargets.length))];
      this.passTo(holder, receiver);
      return;
    }

    // Occasionally the opponent wins the ball through pressure/tackling.
    if (pressure && Math.random() < 0.20) {
      const opponent = nearestOpponent.player;
      if (opponent) {
        this.assignPossession(opponent);
        this.addCommentary(`${opponent.name} wins the ball for ${opponent.team}`);
        return;
      }
    }

    if (holder.dribbling) {
      this.state.ball.action = 'dribble';
    } else {
      this.state.ball.action = 'control';
    }
  }

  simulateEvent() {
    const holder = this.getHolder();
    if (!holder) return;

    const direction = this.getAttackDirection(holder.side);
    const goalX = this.getGoalX(holder.side);
    const distanceToGoal = Math.abs(goalX - holder.x);
    const chance = Math.random();

    // Shots are only common when the ball is actually in a dangerous area.
    const shootingRange = holder.role === 'FWD' ? 35 : holder.role === 'MID' ? 27 : 18;

    if ((holder.role === 'FWD' || holder.role === 'MID') && distanceToGoal < shootingRange && chance < 0.16) {
      this.attemptGoal(holder);
      return;
    }

    if (holder.role === 'FWD' && holder.dribbling && chance < 0.20) {
      this.addCommentary(`${holder.name} dribbles forward and beats a defender`);
    } else if (chance < 0.055) {
      this.addCommentary(`${holder.name} carries the ball forward for ${holder.team}`);
    } else if (chance < 0.085) {
      this.addCommentary(`${holder.name} looks up for a teammate`);
    } else if (chance < 0.11) {
      this.addCommentary(`${holder.name} is challenged in midfield`);
    }
  }

  attemptGoal(shooter) {
    if (shooter.role !== 'FWD' && shooter.role !== 'MID') {
      this.addCommentary(`${shooter.name} looks for a forward pass`);
      return;
    }

    const goalkeeper = this.players.find(p => p.side !== shooter.side && p.role === 'GK');
    const distanceToGoal = Math.abs(this.getGoalX(shooter.side) - shooter.x);
    const distanceBonus = this.clamp((40 - distanceToGoal) * 0.8, 0, 20);
    const attackStrength = (shooter.rating || 70) + distanceBonus + Math.random() * 30;
    const keeperStrength = goalkeeper ? (goalkeeper.rating || 70) + Math.random() * 30 : 75;

    this.addCommentary(`${shooter.name} shoots from ${this.state.displayClock}`);
    this.state.ball.action = 'shot';

    if (attackStrength > keeperStrength + 7) {
      this.scoreGoal(shooter);
    } else {
      this.addCommentary(`${goalkeeper ? goalkeeper.name : 'The goalkeeper'} makes the save`);
      this.state.ball.x = goalkeeper ? goalkeeper.x : this.getGoalX(shooter.side);
      this.state.ball.y = goalkeeper ? goalkeeper.y : 50;
      this.state.ball.holder = goalkeeper ? goalkeeper.id : null;
      this.state.ball.action = 'save';
    }
  }

  scoreGoal(scorer) {
    const side = scorer.side;
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    const otherSide = side === 'home' ? 'away' : 'home';

    this.state.score[side] += 1;
    this.state.ball.x = 50;
    this.state.ball.y = 50;
    this.state.ball.holder = null;
    this.state.ball.action = 'goal';

    this.state.goal = {
      team,
      scorer: scorer.name,
      score: `${this.state.score.home} - ${this.state.score.away}`,
      clock: this.state.displayClock,
      description: `${scorer.name} scores for ${team}. The teams reset and ${this.awayTeam === team ? this.homeTeam : this.awayTeam} will restart.`
    };

    this.addCommentary(`GOAL! ${team} — ${scorer.name} scores. ${this.state.score.home} - ${this.state.score.away}`);
    this.addCommentary(`Players return toward the centre for the restart.`);

    // The team that conceded gets the next kick-off, just like a normal match.
    this.kickoffSide = otherSide;
    this.goalResetTicks = 2;
    this.resetPlayersToShape();
  }

  resetPlayersToShape() {
    for (const player of this.players) {
      player.targetX = player.baseX;
      player.targetY = player.baseY;
      player.dribbling = false;
      player.attacking = false;
      player.hasBall = false;
      player.x += (player.baseX - player.x) * 0.55;
      player.y += (player.baseY - player.y) * 0.55;
    }
  }

  movePlayersForRestart() {
    for (const player of this.players) {
      const direction = this.getAttackDirection(player.side);
      const centrePull = player.role === 'FWD' ? 0.65 : player.role === 'MID' ? 0.5 : 0.35;
      const targetX = player.baseX + (50 - player.baseX) * centrePull;
      const targetY = player.baseY + (50 - player.baseY) * (player.role === 'FWD' ? 0.2 : 0.12);
      this.moveTowards(player, targetX, targetY, 0.35);
      if (Math.abs(player.x - 50) < 8 && player.role === 'FWD') player.x += direction * 2;
    }
    this.state.ball.x = 50;
    this.state.ball.y = 50;
    this.state.ball.holder = null;
    this.state.ball.action = 'restart';
  }

  prepareKickoff(side) {
    this.kickoffSide = side;
    this.resetPlayersToShape();
    const kickoff = this.getTeamPlayers(side).find(p => p.role === 'MID')
      || this.getTeamPlayers(side).find(p => p.role === 'FWD');
    if (kickoff) {
      kickoff.x = side === 'home' ? 49 : 51;
      kickoff.y = 50;
      this.assignPossession(kickoff);
      this.state.ball.x = 50;
      this.state.ball.y = 50;
      this.state.ball.action = 'kickoff';
      this.addCommentary(`KICK OFF — ${side === 'home' ? this.homeTeam : this.awayTeam}`);
    }
  }

  resetAfterHalf() {
    this.resetPlayersToShape();
    this.state.ball.x = 50;
    this.state.ball.y = 50;
    this.state.ball.holder = null;
    this.state.ball.action = 'half_time';
    this.kickoffSide = 'away';
    this.prepareKickoff('away');
  }

  assignPossession(player) {
    if (!player) return;
    for (const p of this.players) p.hasBall = p.id === player.id;
    this.state.ball.holder = player.id;
    this.state.ball.x = player.x;
    this.state.ball.y = player.y;
    this.state.ball.action = player.role === 'FWD' ? 'dribble' : 'control';
  }

  updateBallFromHolder() {
    const holder = this.getHolder();
    if (!holder) return;
    this.state.ball.x = this.clamp(holder.x + (holder.dribbling ? this.getAttackDirection(holder.side) * 1.4 : 0), 2, 98);
    this.state.ball.y = this.clamp(holder.y, 3, 97);
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
