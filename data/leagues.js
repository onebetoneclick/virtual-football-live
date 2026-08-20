// Club catalogue for the virtual-football simulator.
// This is presentation/simulation data only; it does not contain betting odds.

const leagues = [
  {
    id: 'england',
    name: 'England',
    competition: 'Premier League',
    clubs: [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton & Hove Albion',
      'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham',
      'Leeds United', 'Liverpool', 'Manchester City', 'Manchester United',
      'Newcastle United', 'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur',
      'West Ham United', 'Wolverhampton Wanderers'
    ]
  },
  {
    id: 'spain',
    name: 'Spain',
    competition: 'La Liga',
    clubs: [
      'Athletic Club', 'Atlético Madrid', 'Barcelona', 'Celta Vigo', 'Elche',
      'Espanyol', 'Getafe', 'Girona', 'Levante', 'Mallorca', 'Osasuna',
      'Rayo Vallecano', 'Real Betis', 'Real Madrid', 'Real Oviedo',
      'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal', 'Alavés'
    ]
  },
  {
    id: 'italy',
    name: 'Italy',
    competition: 'Serie A',
    clubs: [
      'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Cremonese', 'Fiorentina',
      'Genoa', 'Hellas Verona', 'Inter Milan', 'Juventus', 'Lazio', 'Lecce',
      'Milan', 'Napoli', 'Parma', 'Pisa', 'Roma', 'Sassuolo', 'Torino', 'Udinese'
    ]
  },
  {
    id: 'germany',
    name: 'Germany',
    competition: 'Bundesliga',
    clubs: [
      'Augsburg', 'Bayer Leverkusen', 'Bayern Munich', 'Borussia Dortmund',
      'Borussia Mönchengladbach', 'Eintracht Frankfurt', 'Freiburg', 'Hamburg',
      'Heidenheim', 'Hoffenheim', 'Mainz 05', 'RB Leipzig', 'St. Pauli',
      'Union Berlin', 'VfB Stuttgart', 'Werder Bremen', 'Wolfsburg', 'FC Köln'
    ]
  },
  {
    id: 'france',
    name: 'France',
    competition: 'Ligue 1',
    clubs: [
      'Angers', 'Auxerre', 'Brest', 'Le Havre', 'Lens', 'Lille', 'Lorient',
      'Lyon', 'Marseille', 'Monaco', 'Nantes', 'Nice', 'Paris Saint-Germain',
      'Rennes', 'Saint-Étienne', 'Strasbourg', 'Toulouse', 'Metz'
    ]
  },
  {
    id: 'champions-league',
    name: 'Champions League',
    competition: 'UEFA Champions League',
    clubs: [
      'Arsenal', 'Barcelona', 'Bayern Munich', 'Borussia Dortmund', 'Chelsea',
      'Inter Milan', 'Juventus', 'Liverpool', 'Manchester City', 'Monaco',
      'Napoli', 'Olympiacos', 'Paris Saint-Germain', 'PSV Eindhoven',
      'Real Madrid', 'Sporting CP', 'Tottenham Hotspur', 'Villarreal'
    ]
  }
];

module.exports = { leagues };
