/**
 * Set curado de ícones para personas (Spec 60). Guardamos apenas a *chave*
 * no banco (`ResponsibleParty.icon`); o componente MUI correspondente vive no
 * client (`PartyAvatar` / picker), mapeado por esta mesma chave.
 *
 * Módulo puro (sem import de MUI) para poder ser usado no schema Zod (server + client).
 */

export const PERSONA_ICONS = [
  { key: "person", label: "Pessoa" },
  { key: "people", label: "Casal / grupo" },
  { key: "family", label: "Família" },
  { key: "child", label: "Criança" },
  { key: "pet", label: "Pet" },
  { key: "home", label: "Casa" },
  { key: "heart", label: "Coração" },
  { key: "star", label: "Estrela" },
  { key: "work", label: "Trabalho" },
  { key: "school", label: "Escola" },
  { key: "savings", label: "Poupança" },
  { key: "shopping", label: "Compras" },
  { key: "travel", label: "Viagem" },
  { key: "restaurant", label: "Restaurante" },
  { key: "car", label: "Carro" },
  { key: "gift", label: "Presente" },
] as const;

export type PersonaIconKey = (typeof PERSONA_ICONS)[number]["key"];

export const PERSONA_ICON_KEYS = PERSONA_ICONS.map((i) => i.key) as [
  PersonaIconKey,
  ...PersonaIconKey[],
];

export function isPersonaIconKey(value: string | null | undefined): value is PersonaIconKey {
  return !!value && (PERSONA_ICON_KEYS as readonly string[]).includes(value);
}
