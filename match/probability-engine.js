class ProbabilityEngine {
  constructor(options = {}) {
    this.updateEveryMs = options.updateEveryMs || 1000;
  }

  clamp(value, min = 1, max = 98) {
    return Math.max(min, Math.min(max, value));
  }

  calculate(state) {
    const homeScore = Number(state?.score?.home || 0);
    const awayScore = Number(state?.score?.away || 0);
    const players = Array.isArray(state?.players) ? state.players : [];

    let home = 50;
    let away = 50;

    // Current score is the strongest live-match factor.
    const scoreDiff = homeScore - awayScore;
    home += scoreDiff * 12;
    away -= scoreDiff * 12;

    // Player ratings and available players provide a small team-strength factor.
    for (const side of ['home', 'away']) {
      const team = players.filter(p => p.side === side && !p.injured);
      const unavailable = players.filter(p => p.side === side && p.injured).length;
      const rating = team.length
        ? team.reduce((sum, p) => sum + Number(p.rating || 70), 0) / team.length
        : 70;
      const strength = (rating - 70) * 0.35 - unavailable * 1.5;
      if (side === 'home') home += strength;
      else away += strength;
    }

    // Ball position and possession create a small momentum effect.
    const holder = players.find(p => p.id === state?.ball?.holder);
    if (holder) {
      if (holder.side === 'home') home += 2.5;
      else away += 2.5;

      const attacking = holder.side === 'home'
        ? Number(holder.x || 50)
        : 100 - Number(holder.x || 50);
      const pressure = Math.max(0, attacking - 50) * 0.12;
      if (holder.side === 'home') home += pressure;
      else away += pressure;
    }

    // Keep the values stable but changing rather than jumping wildly.
    const total = Math.max(1, home + away);
    let homeProbability = this.clamp((home / total) * 100);
    let awayProbability = this.clamp((away / total) * 100);
    let drawProbability = this.clamp(100 - homeProbability - awayProbability, 3, 45);

    // Normalize to exactly 100.
    const sum = homeProbability + awayProbability + drawProbability;
    homeProbability = Number((homeProbability / sum * 100).toFixed(1));
    awayProbability = Number((awayProbability / sum * 100).toFixed(1));
    drawProbability = Number((100 - homeProbability - awayProbability).toFixed(1));

    return {
      home: {
        club: state.homeTeam,
        probability: homeProbability
      },
      draw: {
        probability: drawProbability
      },
      away: {
        club: state.awayTeam,
        probability: awayProbability
      },
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = ProbabilityEngine;
module.exports.ProbabilityEngine = ProbabilityEngine;
