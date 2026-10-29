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
  { name: 'Intrigue', color: '#c2410c', template: ['Résumé', 'Objectifs', 'Personnages impliqués', 'Déroulement', 'Résolution'] },
  { name: 'Magie', color: '#4f46e5', template: ['Système de magie', 'Sorts connus', 'Objets magiques', 'Rituels', 'Limites et faiblesses'] },
  { name: 'Créature', color: '#a16207', template: ['Apparence', 'Habitat', 'Comportement', 'Pouvoirs et capacités', 'Relations avec les autres créatures'] },
  { name: 'Événement', color: '#b45309', template: ['Résumé', 'Lieu et date', 'Personnages impliqués', 'Conséquences', 'Répercussions à long terme'] },
  { name: 'Autre', color: '#6b7280', template: ['Description', 'Détails supplémentaires'] },
  { name: 'Important', color: '#f59e0b', template: ['Résumé', 'Détails clés', 'Conséquences', 'Répercussions à long terme'] },
  { name: 'Ressource', color: '#059669', template: ['Description', 'Utilisation', 'Disponibilité', 'Valeur'] },
  
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