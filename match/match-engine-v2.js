const { clubsById } = require('../data/clubs');

class MatchEngineV2 {
  constructor(options = {}) {
    this.duration = options.duration || 180;
    this.halfTime = this.duration / 2;
    this.tickMs = options.tickMs || 1000;
    this.interval = null;
    this.resetTicks = 0;
    this.kickoffSide = 'home';
    this.cooldown = 0;

    this.homeClub = options.homeClub || this.getClub('england');
    this.awayClub = options.awayClub || this.getClub('england', this.homeClub.id);
    this.homeTeam = this.homeClub.name;
    this.awayTeam = this.awayClub.name;
    this.players = this.createPlayers();

    this.state = {
      status:'not_started', period:'first_half', clock:0, displayClock:'00:00',
      score:{home:0,away:0}, homeTeam:this.homeTeam, awayTeam:this.awayTeam,
      homeLogo:this.homeClub.logo || null, awayLogo:this.awayClub.logo || null,
      players:this.players, ball:{x:50,y:50,holder:null,action:'stationary'},
      commentary:[], events:[], lastEvent:null, goal:null
    };
  }

  getClub(leagueId, excludeId) {
    const list = Object.values(clubsById).filter(c => c.leagueId === leagueId);
    return list.find(c => c.id !== excludeId) || list[0];
  }

  role(position) {
    const p = String(position || '').toUpperCase();
    if (p.includes('GK') || p.includes('GOAL')) return 'GK';
    if (p.includes('DEF') || p.includes('BACK')) return 'DEF';
    if (p.includes('FWD') || p.includes('FORWARD') || p.includes('ST') || p.includes('CF') || p.includes('WING')) return 'FWD';
    return 'MID';
  }

  createPlayers() {
    const shape = [
      [6,50],[17,18],[16,40],[16,60],[17,82],
      [34,20],[38,50],[34,78],[57,25],[63,50],[57,75]
    ];
    const make = (club, side) => (club.squad || []).slice(0,11).map((p,i) => {
      const [sx,sy] = shape[i] || [30,50];
      return {id:`${side}-${p.id}`,name:p.name,number:p.number,position:p.position,
        role:this.role(p.position),rating:p.rating || 70,team:club.name,clubId:club.id,side,
        x:side==='home'?sx:100-sx,y:sy,baseX:side==='home'?sx:100-sx,baseY:sy,
        seed:Math.random()*100,hasBall:false,injured:false,redCard:false};
    });
    return [...make(this.homeClub,'home'),...make(this.awayClub,'away')];
  }

  start() {
    if (this.interval || this.state.status === 'finished') return;
    this.state.status='running';
    this.addCommentary(`KICK OFF — ${this.homeTeam} vs ${this.awayTeam}`);
    this.kickoff('home');
    this.interval=setInterval(()=>this.tick(),this.tickMs);
  }

  stop(){ if(this.interval) clearInterval(this.interval); this.interval=null; }

  getState(){ return this.state; }
  direction(side){ return side==='home'?1:-1; }
  goalX(side){ return side==='home'?98:2; }
  clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  holder(){ return this.players.find(p=>p.id===this.state.ball.holder) || null; }
  team(side){ return this.players.filter(p=>p.side===side && !p.redCard); }

  clockText(){
    const s=Math.min(5400,this.state.clock*30);
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }

  tick(){
    if(this.state.clock>=this.duration){
      this.state.status='finished';this.state.period='full_time';this.state.displayClock='90:00';
      this.addCommentary(`FULL TIME — ${this.homeTeam} ${this.state.score.home} - ${this.state.score.away} ${this.awayTeam}`);this.stop();return;
    }
    this.state.clock++;this.state.displayClock=this.clockText();
    if(this.state.clock<this.halfTime)this.state.period='first_half';
    else if(this.state.clock===this.halfTime){this.state.period='half_time';this.addCommentary('HALF TIME');this.kickoff('away');return;}
    else this.state.period='second_half';
    this.state.goal=null;if(this.cooldown>0)this.cooldown--;
    if(this.resetTicks>0){this.resetTicks--;this.resetShape(.12);if(this.resetTicks===0)this.kickoff(this.kickoffSide);return;}
    this.movePlayers();this.playBall();this.events();this.followBall();
  }

  move(p,tx,ty,s=.12){
    p.x+=(this.clamp(tx,2,98)-p.x)*s;p.y+=(this.clamp(ty,4,96)-p.y)*s;
  }

  movePlayers(){
    const h=this.holder(), bx=this.state.ball.x, by=this.state.ball.y;
    for(const p of this.players){
      if(p.redCard||p.injured)continue;
      const d=this.direction(p.side), attack=this.goalX(p.side), own=p.side==='home'?0:100;
      let tx=p.baseX,ty=p.baseY;
      const same=h&&h.side===p.side, opp=h&&h.side!==p.side;
      tx+=(bx-tx)*(same?.35:opp?.20:.10);ty+=(by-ty)*(same?.35:opp?.22:.12);
      const wave=Math.sin((this.state.clock+p.seed)*.13), lane=Math.cos((this.state.clock+p.seed)*.11);
      if(p.role==='FWD'){tx+=d*(same?7:1);ty+=lane*7;}
      if(p.role==='MID'){tx+=d*(same?4:0);ty+=lane*5;}
      if(p.role==='DEF'){tx+=d*(same?3:-1);ty+=lane*3.5;}
      if(p.role==='GK'){tx=p.side==='home'?6:94;ty=this.clamp(50+(by-50)*.3,36,64);}
      if(h&&h.id===p.id){
        tx=p.x+d*(p.role==='FWD'?3.0:1.7);ty=p.y+(Math.random()-.5)*4;
        if(p.role==='FWD'&&Math.abs(attack-bx)<30)tx=attack-d*(5+Math.random()*8);
      }
      if(same&&Math.abs(attack-bx)<25&&p.role==='MID')tx+=d*6;
      // Slightly slower than before: individual movement remains independent.
      this.move(p,tx,ty,h&&h.id===p.id?.20:.105+(p.rating/2200));
    }
  }

  nearestOpponent(p){
    return this.players.filter(x=>x.side!==p.side&&!x.redCard).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  }

  passTargets(h){
    const d=this.direction(h.side);
    return this.team(h.side).filter(p=>p.id!==h.id&&p.role!=='GK').map(p=>({p,score:50-Math.hypot(p.x-h.x,p.y-h.y)+((p.x-h.x)*d)})).sort((a,b)=>b.score-a.score).slice(0,4).map(x=>x.p);
  }

  playBall(){
    let h=this.holder();if(!h){this.kickoff(this.kickoffSide);return;}
    const near=this.nearestOpponent(h), targets=this.passTargets(h);
    if(near&&Math.hypot(near.x-h.x,near.y-h.y)<12&&targets.length&&Math.random()<.5){
      const r=targets[0];this.state.ball.action='pass';this.state.ball.holder=r.id;this.addCommentary(`${h.name} passes to ${r.name}`);return;
    }
    if(targets.length&&Math.random()<.07){const r=targets[Math.floor(Math.random()*targets.length)];this.state.ball.action='pass';this.state.ball.holder=r.id;this.addCommentary(`${h.name} plays the ball to ${r.name}`);return;}
    if(h.role==='FWD'&&Math.random()<.16){this.state.ball.action='dribble';this.addCommentary(`${h.name} dribbles forward`);}
  }

  followBall(){const h=this.holder();if(h){this.state.ball.x=h.x;this.state.ball.y=h.y;}}

  kickoff(side){
    this.kickoffSide=side;this.resetShape(.35);
    const candidates=this.team(side).filter(p=>p.role==='MID'||p.role==='FWD');
    const p=candidates[0]||this.team(side)[0];
    if(p){p.x=side==='home'?48:52;p.y=50;for(const x of this.players)x.hasBall=false;p.hasBall=true;this.state.ball={x:p.x,y:p.y,holder:p.id,action:'kickoff'};}
    this.addCommentary(`KICK OFF — ${side==='home'?this.homeTeam:this.awayTeam}`);
  }

  resetShape(speed){for(const p of this.players){p.x+=(p.baseX-p.x)*speed;p.y+=(p.baseY-p.y)*speed;p.hasBall=false;}this.state.ball.holder=null;this.state.ball.action='restart';}

  addCommentary(text){this.state.commentary.push({time:this.state.displayClock,text});if(this.state.commentary.length>50)this.state.commentary.shift();}

  event(kind,team,player,text,symbol){
    const e={id:`${this.state.clock}-${Date.now()}`,kind,symbol,minute:this.state.displayClock,team,player:player?.name||null,text};
    this.state.events.push(e);if(this.state.events.length>80)this.state.events.shift();this.state.lastEvent=e;this.addCommentary(`${symbol} ${text}`);this.cooldown=5;return e;
  }

  events(){
    if(this.cooldown>0)return;const h=this.holder();if(!h)return;
    const nearGoal=Math.abs(this.goalX(h.side)-h.x)<17;
    if(h.role==='FWD'&&nearGoal&&Math.random()<.06){this.goal(h);return;}
    if(nearGoal&&Math.random()<.035){this.event('corner',h.team,h,`Corner for ${h.team}`,'🚩');this.state.ball.action='corner';return;}
    if(Math.random()<.012){const side=Math.random()<.5?'home':'away';const team=side==='home'?this.homeTeam:this.awayTeam;this.event('goal_kick',team,null,`Goal kick to ${team}`,'🥅');this.state.ball.action='goal_kick';return;}
    if(Math.random()<.006)this.event('yellow_card',h.team,h,`${h.name} receives a yellow card`,'🟨');
    else if(Math.random()<.001)this.red(h);
    else if(Math.random()<.002){h.injured=true;this.event('injury',h.team,h,`${h.name} is injured and receives treatment`,'🩹');}
  }

  red(p){p.redCard=true;this.event('red_card',p.team,p,`${p.name} is shown a red card`,'🟥');}

  goal(scorer){
    const side=scorer.side,team=side==='home'?this.homeTeam:this.awayTeam;this.state.score[side]++;
    this.state.ball.holder=null;this.state.ball.action='shot';this.state.ball.x=side==='home'?101:-1;this.state.ball.y=this.clamp(scorer.y,10,90);
    const e=this.event('goal',team,scorer,`GOAL! ${team} — ${this.state.score.home} - ${this.state.score.away}`,'⚽');
    this.state.goal={team,scorer:scorer.name,score:`${this.state.score.home} - ${this.state.score.away}`,eventId:e.id};
    this.kickoffSide=side==='home'?'away':'home';this.resetTicks=4;
  }
}

module.exports=MatchEngineV2;
module.exports.MatchEngine=MatchEngineV2;
module.exports.createMatchEngine=(options={})=>new MatchEngineV2(options);
