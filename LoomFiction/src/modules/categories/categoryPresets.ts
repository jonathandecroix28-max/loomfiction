export interface CategoryPreset {
  name: string;
  color: string;
  template?: string[];
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  { name: 'Personnage', color: '#be123c', template: ['Apparence', 'Personnalité', 'Histoire', 'Relations', 'Objectifs', 'Secrets'] },
  { name: 'Lieu', color: '#15803d', template: ['Description', 'Ambiance', 'Histoire', 'Habitants', 'Secrets'] },
  { name: 'Objet', color: '#0e7490', template: ['Apparence', 'Pouvoirs', 'Origine', 'Détenteur actuel'] },
  { name: 'Faction', color: '#7c3aed', template: ['Idéologie', 'Membres clés', 'Histoire', 'Alliés et ennemis', 'Ressources'] },
  { name: 'Intrigue', color: '#c2410c' },
  { name: 'Magie', color: '#4f46e5' },
];

export const CATEGORY_COLORS = ['#b45309', '#be123c', '#15803d', '#0e7490', '#7c3aed', '#c2410c', '#4f46e5', '#a16207'];

export const nameKey = (name: string): string =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/s$/, '');

export const presetFor = (name: string): CategoryPreset | undefined =>
  CATEGORY_PRESETS.find((preset) => nameKey(preset.name) === nameKey(name));

export function nextColor(used: Array<string | undefined>): string {
  const taken = new Set(used.map((color) => color?.toLowerCase()));
  return CATEGORY_COLORS.find((color) => !taken.has(color)) ?? CATEGORY_COLORS[used.length % CATEGORY_COLORS.length];
}