// Hat, shirt and pet lists (no three.js, so the server and game rules can use them too).
export const HATS = [
  { id: 'none', name: 'No hat', emoji: '' },
  { id: 'cap', name: 'Ball Cap', emoji: '🧢' },
  { id: 'tophat', name: 'Top Hat', emoji: '🎩' },
  { id: 'crown', name: 'Crown', emoji: '👑' },
  { id: 'grad', name: 'Grad Cap', emoji: '🎓' },
  { id: 'sunhat', name: 'Sun Hat', emoji: '👒' },
  { id: 'helmet', name: 'Army Helmet', emoji: '🪖' },
  { id: 'bow', name: 'Big Bow', emoji: '🎀' },
  { id: 'flower', name: 'Flower', emoji: '🌸' },
  { id: 'headphones', name: 'Headphones', emoji: '🎧' },
  { id: 'party', name: 'Party Hat', emoji: '🎉' },
  { id: 'duck', name: 'Duck Buddy', emoji: '🐤' },
];
export const SHIRTS = [
  { id: 'none', name: 'No shirt' },
  { id: 'redtee', name: 'Red Tee', c: '#d63030' },
  { id: 'stripes', name: 'Stripes', c: '#ffffff' },
  { id: 'hawaii', name: 'Hawaiian', c: '#1ab0a0' },
  { id: 'tux', name: 'Tuxedo', c: '#151515' },
  { id: 'hoodie', name: 'Grey Hoodie', c: '#7a8088' },
  { id: 'life', name: 'Life Jacket', c: '#ff7a10' },
  { id: 'overalls', name: 'Overalls', c: '#3a5f9a' },
  { id: 'sweater', name: 'Xmas Sweater', c: '#2a8a3a' },
  { id: 'camo', name: 'Camo', c: '#5a6a30' },
];
export const PETS = [
  { id: 'none', name: 'No pet', emoji: '' },
  { id: 'duckling', name: 'Duckling', emoji: '🐥' },
  { id: 'frog', name: 'Frog', emoji: '🐸' },
  { id: 'crab', name: 'Crab', emoji: '🦀' },
  { id: 'droplet', name: 'Droplet', emoji: '💧' },
  { id: 'snail', name: 'Snail', emoji: '🐌' },
  { id: 'jelly', name: 'Jellyfish', emoji: '🪼' },
  { id: 'goldfish', name: 'Goldfish Bowl', emoji: '🐠' },
  { id: 'bee', name: 'Bee', emoji: '🐝' },
];
export function randomCos(R = Math.random) {
  const pick = a => a[1 + Math.floor(R() * (a.length - 1))].id;
  return { hat: R() < 0.75 ? pick(HATS) : 'none', shirt: R() < 0.6 ? pick(SHIRTS) : 'none', pet: R() < 0.45 ? pick(PETS) : 'none' };
}
export function cleanCos(c) {
  const ok = (a, v) => a.some(x => x.id === v) ? v : 'none';
  return { hat: ok(HATS, c && c.hat), shirt: ok(SHIRTS, c && c.shirt), pet: ok(PETS, c && c.pet) };
}
