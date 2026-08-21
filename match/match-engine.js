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
    const makeTeam = (club, side) => {
      const squad = club.squad || [];
      const starting = squad.slice(0, 11);

      // Tactical home positions. Away positions are mirrored.
      // GK stays deepest, defenders stay behind midfielders,
      // midfielders connect the lines, and forwards stay highest.
      const formation = [
        { role: 'GK',  x: 7,  y: 50 },
        { role: 'DEF', x: 18, y: 20 },
        { role: 'DEF', x: 18, y: 40 },
        { role: 'DEF', x: 18, y: 60 },
        { role: 'DEF', x: 18, y: 80 },
        { role: 'MID', x: 38, y: 25 },
        { role: 'MID', x: 38, y: 50 },
        { role: 'MID', x: 38, y: 75 },
        { role: 'FWD', x: 62, y: 25 },
        { role: 'FWD', x: 66, y: 50 },
        { role: 'FWD', x: 62, y: 75 }
      ];

      return starting.map((player, index) => {
        const tactical = formation[index];
        const role = this.normalizeRole(player.position);
        const baseX = tactical.x;
        const x = side === 'home' ? baseX : 100 - baseX;

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
          attacking: false
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
      this.resetAfterHalf();
      return;
    } else {
      this.state.period = 'second_half';
    }

    this.state.goal = null;
    this.movePlayersTactically();
    this.simulatePossessionAndBall();
    this.simulateEvent();
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

  getTacticalLimits(player) {
    const direction = this.getAttackDirection(player.side);

    if (player.role === 'GK') {
      return {
        minX: direction === 1 ? 3 : 72,
        maxX: direction === 1 ? 18 : 97,
        minY: 35,
        maxY: 65
      };
    }

    if (player.role === 'DEF') {
      return {
        minX: direction === 1 ? 8 : 58,
        maxX: direction === 1 ? 38 : 92,
        minY: 10,
        maxY: 90
      };
    }

    if (player.role === 'MID') {
      return {
        minX: direction === 1 ? 22 : 42,
        maxX: direction === 1 ? 62 : 78,
        minY: 8,
        maxY: 92
      };
    }

    // Forwards are the players allowed to move furthest forward.
    return {
      minX: direction === 1 ? 42 : 58,
      maxX: direction === 1 ? 96 : 58,
      minY: 5,
      maxY: 95
    };
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  moveTowards(player, targetX, targetY, speed = 0.35) {
    const limits = this.getTacticalLimits(player);
    const x = this.clamp(targetX, limits.minX, limits.maxX);
    const y = this.clamp(targetY, limits.minY, limits.maxY);

    player.targetX = x;
    player.targetY = y;
    player.x += (x - player.x) * speed;
    player.y += (y - player.y) * speed;
  }

  movePlayersTactically() {
    const holder = this.getHolder();
    const ballX = this.state.ball.x;
    const ballY = this.state.ball.y;

    for (const player of this.players) {
      const direction = this.getAttackDirection(player.side);
      const isHolder = holder && player.id === holder.id;
      const sameTeamHasBall = holder && holder.side === player.side;
      const opponentHasBall = holder && holder.side !== player.side;

      player.dribbling = false;
      player.attacking = false;

      if (player.role === 'GK') {
        // Goalkeepers stay in their penalty area and shift with the ball.
        const keeperX = direction === 1
          ? this.clamp(7 + (ballX - 50) * 0.04, 5, 13)
          : this.clamp(93 + (ballX - 50) * 0.04, 87, 95);
        const keeperY = this.clamp(50 + (ballY - 50) * 0.25, 40, 60);
        this.moveTowards(player, keeperX, keeperY, 0.25);
        continue;
      }

      // Basic tactical shape around the player's assigned position.
      let targetX = player.baseX;
      let targetY = player.baseY;

      if (player.side === 'away') {
        targetX = player.baseX;
      }

      // Teammates move toward the ball, but only within their role's zone.
      if (sameTeamHasBall) {
        const ballInfluence = player.role === 'FWD' ? 0.30 : player.role === 'MID' ? 0.22 : 0.10;
        targetX += (ballX - targetX) * ballInfluence;
        targetY += (ballY - targetY) * ballInfluence;

        // Midfielders are the main forward support runners.
        if (player.role === 'MID') {
          targetX += direction * 3;
          player.attacking = true;
        }

        // Defenders can support the attack slightly, but do not become forwards.
        if (player.role === 'DEF') {
          targetX += direction * 1.2;
        }
      }

      // When defending, players track the ball and retreat toward their shape.
      if (opponentHasBall) {
        const ballDistance = Math.abs(ballX - player.x);
        const tracking = ballDistance < 30 ? 0.18 : 0.08;
        targetX += (ballX - targetX) * tracking;
        targetY += (ballY - targetY) * tracking;

        if (player.role === 'DEF') {
          targetX -= direction * 1.5;
        }
      }

      // The player with possession gets special movement.
      if (isHolder) {
        if (player.role === 'FWD') {
          // Forwards dribble: carry the ball forward and change lane slightly.
          player.dribbling = true;
          targetX = player.x + direction * 5.5;
          targetY = player.y + (Math.random() - 0.5) * 7;
        } else if (player.role === 'MID') {
          // Midfielders can carry forward, but less aggressively.
          targetX = player.x + direction * 3;
          targetY = player.y + (Math.random() - 0.5) * 4;
        } else {
          // Defenders with the ball can step forward briefly, never into the striker zone.
          targetX = player.x + direction * 1.5;
        }
      }

      // Small natural movement around the tactical target.
      targetY += (Math.random() - 0.5) * 1.8;

      this.moveTowards(player, targetX, targetY, isHolder ? 0.55 : 0.28);
    }
  }

  resetAfterHalf() {
    for (const player of this.players) {
      player.targetX = player.baseX;
      player.targetY = player.baseY;
      player.dribbling = false;
      player.attacking = false;
      player.x += (player.baseX - player.x) * 0.35;
      player.y += (player.baseY - player.y) * 0.35;
    }

    this.state.ball.x = 50;
    this.state.ball.y = 50;
    this.state.ball.holder = null;
    this.state.ball.action = 'half_time';
  }

  getPassTargets(holder) {
    if (!holder) return [];

    return this.players.filter(player => {
      if (player.side !== holder.side || player.id === holder.id) return false;

      // Defenders prefer safe passes backward/sideways.
      if (holder.role === 'DEF') {
        return player.role === 'DEF' || player.role === 'MID';
      }

      // Midfielders connect defence to attack.
      if (holder.role === 'MID') {
        return player.role === 'DEF' || player.role === 'MID' || player.role === 'FWD';
      }

      // Forwards prefer midfield support or another forward.
      if (holder.role === 'FWD') {
        return player.role === 'MID' || player.role === 'FWD';
      }

      return player.role !== 'GK';
    });
  }

  simulatePossessionAndBall() {
    let holder = this.getHolder();
    const pressure = Math.random();

    if (!holder || pressure < 0.14) {
      const targets = this.getPassTargets(holder);
      const receiver = targets.length
        ? targets[Math.floor(Math.random() * targets.length)]
        : this.getPlayerBySide(holder ? holder.side : 'home');

      if (receiver) {
        if (holder && holder.id !== receiver.id) {
          this.addCommentary(`${holder.name} passes to ${receiver.name}`);
          this.state.ball.action = 'pass';
        }
        holder = receiver;
        this.assignPossession(holder);
      }
    }

    if (holder) {
      if (holder.dribbling) {
        this.state.ball.action = 'dribble';
      }

      this.state.ball.x = this.clamp(holder.x + (holder.dribbling ? this.getAttackDirection(holder.side) * 1.5 : 0), 2, 98);
      this.state.ball.y = this.clamp(holder.y, 3, 97);
    }
  }

  simulateEvent() {
    const chance = Math.random();
    const holder = this.getHolder();
    if (!holder) return;

    if (holder.role === 'FWD' && holder.dribbling && chance < 0.16) {
      this.addCommentary(`${holder.name} dribbles past a defender`);
    } else if (chance < 0.025) {
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
    if (shooter.role !== 'FWD' && shooter.role !== 'MID') {
      this.addCommentary(`${shooter.name} looks for a forward pass`);
      return;
    }

    const attackStrength = shooter.rating + Math.random() * 30;
    const goalkeeper = this.players.find(p => p.side !== shooter.side && p.role === 'GK');
    const keeperStrength = goalkeeper ? goalkeeper.rating + Math.random() * 30 : 75;

    this.addCommentary(`${shooter.name} shoots from ${this.state.displayClock}`);
    this.state.ball.action = 'shot';

    if (attackStrength > keeperStrength + 8) {
      this.scoreGoal(shooter);
    } else {
      this.addCommentary(`${goalkeeper ? goalkeeper.name : 'The goalkeeper'} makes the save`);
      this.state.ball.x = goalkeeper ? goalkeeper.x : (shooter.side === 'home' ? 93 : 7);
      this.state.ball.y = goalkeeper ? goalkeeper.y : 50;
      this.state.ball.holder = goalkeeper ? goalkeeper.id : null;
      this.state.ball.action = 'save';
    }
  }

  scoreGoal(scorer) {
    const side = scorer.side;
    const team = side === 'home' ? this.homeTeam : this.awayTeam;

    this.state.score[side] += 1;
    this.state.ball.x = side === 'home' ? 98 : 2;
    this.state.ball.y = 50;
    this.state.ball.holder = null;
    this.state.ball.action = 'goal';

    this.state.goal = {
      team,
      scorer: scorer.name,
      score: `${this.state.score.home} - ${this.state.score.away}`,
      clock: this.state.displayClock,
      description: `${scorer.name} dribbles into the attacking area and sends the ball into the net.`
    };

    this.addCommentary(`GOAL! ${team} — ${scorer.name} scores. ${this.state.score.home} - ${this.state.score.away}`);
  }

  assignPossession(player) {
    if (!player) return;

    this.state.ball.holder = player.id;
    this.state.ball.x = player.x;
    this.state.ball.y = player.y;
    this.state.ball.action = player.role === 'FWD' ? 'dribble' : 'control';
  }

  getHolder() {
    return this.players.find(p => p.id === this.state.ball.holder) || null;
  }

  getPlayerBySide(side) {
    return this.players.find(p => p.side === side && p.role === 'MID')
      || this.players.find(p => p.side === side && p.role === 'FWD')
      || this.players.find(p => p.side === side && p.role === 'DEF')
      || this.players.find(p => p.side === side);
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
