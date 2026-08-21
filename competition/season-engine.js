const MatchEngine = require('../match/match-engine-v2');
const { clubs } = require('../data/clubs');

function makeRoundRobin(clubList) {
  const teams=[...clubList]; if(teams.length%2)teams.push(null); const rounds=teams.length-1,half=teams.length/2,schedule=[]; let rotation=[...teams];
  for(let round=0;round<rounds;round++){
    const fixtures=[];
    for(let i=0;i<half;i++){
      const a=rotation[i],b=rotation[rotation.length-1-i]; if(!a||!b)continue;
      fixtures.push({id:`W${round+1}-${fixtures.length+1}`,week:round+1,home:round%2===0?a:b,away:round%2===0?b:a});
    }
    schedule.push(fixtures);rotation=[rotation[0],rotation[rotation.length-1],...rotation.slice(1,-1)];
  }
  return schedule;
}

class SeasonEngine {
  constructor(options={}){
    this.leagueId=options.leagueId||'england';this.week=options.week||1;
    this.fixtures=makeRoundRobin(clubs.filter(c=>c.leagueId===this.leagueId));
    this.matches=[];this.status='scheduled';this.standings=this.createStandings();this.poller=null;
  }
  createStandings(){const t={};clubs.filter(c=>c.leagueId===this.leagueId).forEach(c=>t[c.id]={clubId:c.id,club:c.name,logo:c.logo,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0});return t;}
  getWeekFixtures(w=this.week){return this.fixtures[w-1]||[];}
  startWeek(w=this.week){
    if(this.status==='running')return;const fixtures=this.getWeekFixtures(w);if(!fixtures.length)return;
    this.week=w;this.matches=fixtures.map(f=>({fixture:f,engine:new MatchEngine({homeClub:f.home,awayClub:f.away})}));this.status='running';
    this.matches.forEach(x=>x.engine.start());if(!this.poller)this.poller=setInterval(()=>this.checkWeek(),1000);
  }
  checkWeek(){if(this.status!=='running')return;if(!this.matches.every(x=>x.engine.getState().status==='finished'))return;this.matches.forEach(x=>this.applyResult(x.engine.getState()));this.status='week_complete';}
  findStanding(n){return Object.values(this.standings).find(x=>x.club===n);}
  applyResult(s){if(s._counted)return;const h=this.findStanding(s.homeTeam),a=this.findStanding(s.awayTeam);if(!h||!a)return;const hg=s.score.home,ag=s.score.away;h.played++;a.played++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.won++;h.points+=3;a.lost++;}else if(hg<ag){a.won++;a.points+=3;h.lost++;}else{h.drawn++;a.drawn++;h.points++;a.points++;}h.gd=h.gf-h.ga;a.gd=a.gf-a.ga;s._counted=true;}
  standingsList(){return Object.values(this.standings).sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));}
  weekState(){return {league:this.leagueId,week:this.week,status:this.status,matches:this.matches.map(({fixture,engine})=>{const s=engine.getState();return{id:fixture.id,home:s.homeTeam,away:s.awayTeam,homeLogo:s.homeLogo,awayLogo:s.awayLogo,score:s.score,status:s.status,clock:s.displayClock,lastEvent:s.lastEvent};}),standings:this.standingsList(),nextWeek:this.week<this.fixtures.length?this.week+1:null};}
  selectedState(index=0){const x=this.matches[index]||this.matches[0];return x?x.engine.getState():null;}
}
module.exports={SeasonEngine,makeRoundRobin};
