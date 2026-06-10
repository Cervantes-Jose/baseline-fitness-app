// Universal macro palette + energy factors, shared across the app (Dashboard rings,
// Goals editor, etc.) so Protein/Carbs/Fats always read the same color everywhere.
// Colors match the Dashboard CircleRing colors.
export const MACROS = [
  { key: 'protein', label: 'Protein', goalKey: 'protein_goal', color: '#22C55E', track: '#DCFCE7', factor: 4 },
  { key: 'carbs',   label: 'Carbs',   goalKey: 'carbs_goal',   color: '#EAB308', track: '#FEF9C3', factor: 4 },
  { key: 'fats',    label: 'Fats',    goalKey: 'fats_goal',     color: '#3B82F6', track: '#DBEAFE', factor: 9 },
];

export const MACRO_COLOR = { protein: '#22C55E', carbs: '#EAB308', fats: '#3B82F6' };
