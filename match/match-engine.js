class MatchEngine {
  constructor(options = {}) {
    this.duration = options.duration || 180; // 3 minutes
    this.halfTime = 90; // 1 minute 30 seconds
    this.clock = 0;
    this.interval = null;

    this.state = {
      status: 'not_started',
      period: 'first_half',
      clock: 0,
      score: {
        home: 0,
        away: 0
      },
      ball: {
        x: 50,
        y: 50
      },
      commentary: []
    };
  }

  start() {
    if (this.interval) return;

    this.state.status = 'running';

    this.interval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }

  tick() {
    if (this.clock >= this.duration) {
      this.state.status = 'finished';
      this.addCommentary('FULL TIME');
      this.stop();
      return;
    }

    this.clock += 1;
    this.state.clock = this.clock;

    if (this.clock < this.halfTime) {
      this.state.period = 'first_half';
    } else if (this.clock === this.halfTime) {
      this.state.period = 'half_time';
      this.addCommentary('HALF TIME');
    } else {
      this.state.period = 'second_half';
    }

    if (this.state.period !== 'half_time') {
      this.moveBall();
      this.simulateEvent();
    }
  }

  moveBall() {
    this.state.ball.x = Math.max(5, Math.min(95, this.state.ball.x + (Math.random() - 0.5) * 10));
    this.state.ball.y = Math.max(5, Math.min(95, this.state.ball.y + (Math.random() - 0.5) * 10));
  }

  simulateEvent() {
    const chance = Math.random();

    if (chance < 0.02) {
      const team = Math.random() > 0.5 ? 'home' : 'away';
      this.state.score[team] += 1;
      this.addCommentary(`GOAL! ${team} team scores`);
    } else if (chance < 0.06) {
      this.addCommentary('Shot on target');
    } else if (chance < 0.1) {
      this.addCommentary('Attack developing');
    }
  }

  addCommentary(message) {
    this.state.commentary.unshift({
      message,
      time: this.state.clock
    });

    this.state.commentary = this.state.commentary.slice(0, 20);
  }

  getState() {
    return this.state;
  }
}

module.exports = MatchEngine;
