// Backend club database for the virtual football simulator.
// Each club gets a stable ID and an 18-player virtual squad.
// These are simulation players, not real athletes.

const { leagues } = require('./leagues');

function slug(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const positions = [
  ['GK', 1], ['GK', 13],
  ['DEF', 2], ['DEF', 3], ['DEF', 4], ['DEF', 5], ['DEF', 12],
  ['MID', 6], ['MID', 8], ['MID', 10], ['MID', 14], ['MID', 16],
  ['FWD', 7], ['FWD', 9], ['FWD', 11], ['FWD', 17], ['FWD', 18], ['FWD', 19]
];

const firstNames = ['Alex', 'Daniel', 'Leo', 'Samuel', 'Victor', 'Michael', 'David', 'Jordan', 'Noah', 'Adrian', 'Marcus', 'Ethan', 'Ryan', 'Julian', 'Nathan', 'Isaac', 'Milan', 'Kai'];
const lastNames = ['Adams', 'Bennett', 'Cole', 'Davis', 'Evans', 'Foster', 'Grant', 'Hall', 'Hughes', 'King', 'Lewis', 'Mason', 'Parker', 'Reed', 'Scott', 'Turner', 'Walker', 'Young'];

function makeSquad(clubId) {
  return positions.map(([position, number], index) => ({
    id: `${clubId}-player-${number}`,
    name: `${firstNames[index]} ${lastNames[(index + clubId.length) % lastNames.length]}`,
    number,
    position,
    rating: 70 + ((clubId.length * 7 + index * 3) % 21)
  }));
}

const clubs = leagues.flatMap(league => league.clubs.map(name => {
  const id = `${league.id}-${slug(name)}`;
  return {
    id,
    leagueId: league.id,
    name,
    shortName: name.split(/\s+/).map(w => w[0]).slice(0, 3).join('').toUpperCase(),
    logo: `/api/clubs/${slug(name)}/logo`,
    squad: makeSquad(id)
  };
}));

const clubsById = Object.fromEntries(clubs.map(club => [club.id, club]));

module.exports = { clubs, clubsById, slug };
