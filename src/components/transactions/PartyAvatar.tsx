"use client";

import type { SvgIconComponent } from "@mui/icons-material";
import Avatar from "@mui/material/Avatar";
import { useTheme } from "@mui/material/styles";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import FamilyRestroomOutlinedIcon from "@mui/icons-material/FamilyRestroomOutlined";
import ChildCareOutlinedIcon from "@mui/icons-material/ChildCareOutlined";
import PetsOutlinedIcon from "@mui/icons-material/PetsOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import FlightOutlinedIcon from "@mui/icons-material/FlightOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";

import { getAccentPreset, type AccentColorKey } from "@/lib/accent-colors";
import { type PersonaIconKey } from "@/lib/persona-icons";
import type { ResponsiblePartyKind } from "./types";

/**
 * Chave de ícone → componente MUI (variantes Outlined, visual discreto).
 * Usado pelo seletor de ícone das configurações (`PersonaStyleFields`) — o
 * `PartyAvatar` em si NÃO renderiza mais ícone (ver abaixo), só a inicial.
 */
export const PERSONA_ICON_COMPONENTS: Record<PersonaIconKey, SvgIconComponent> = {
  person: PersonOutlinedIcon,
  people: PeopleOutlinedIcon,
  family: FamilyRestroomOutlinedIcon,
  child: ChildCareOutlinedIcon,
  pet: PetsOutlinedIcon,
  home: HomeOutlinedIcon,
  heart: FavoriteBorderOutlinedIcon,
  star: StarBorderOutlinedIcon,
  work: WorkOutlineOutlinedIcon,
  school: SchoolOutlinedIcon,
  savings: SavingsOutlinedIcon,
  shopping: ShoppingCartOutlinedIcon,
  travel: FlightOutlinedIcon,
  restaurant: RestaurantOutlinedIcon,
  car: DirectionsCarOutlinedIcon,
  gift: CardGiftcardOutlinedIcon,
};

type Props = {
  kind: ResponsiblePartyKind;
  icon: string | null;
  color: string | null;
  /** Foto do usuário (só personal com login). Tem prioridade sobre a inicial. */
  imageUrl?: string | null;
  name: string;
  /** Diâmetro em px. Default 24 (linha compacta). */
  size?: number;
};

/**
 * Avatar visual de uma party (Spec 60 · fidelidade Spec 66 `.av`): foto →
 * círculo colorido com a INICIAL do nome. Nunca ícone genérico de pessoa —
 * o ícone escolhido nas configurações (PersonaStyleFields) só é usado como
 * preview no seletor de ícone, não no avatar em si. Discreto e reutilizável
 * (seletor, coluna da transação, detalhe, configurações).
 */
export function PartyAvatar({ color, imageUrl, name, size = 24 }: Props) {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const initial = name.charAt(0).toUpperCase();
  // Escala proporcional ao tamanho, ancorada nos dois pontos do frame:
  // 24px → 0.68rem, com piso de 0.5rem (mini-avatar 13px dentro de pílula).
  const fontSize = `${Math.max(0.5, (0.68 * size) / 24)}rem`;

  // 1) Foto do usuário, quando houver.
  if (imageUrl) {
    return (
      <Avatar src={imageUrl} alt={name} sx={{ width: size, height: size, fontSize, flexShrink: 0 }}>
        {initial}
      </Avatar>
    );
  }

  // 2) Sem foto: SEMPRE a inicial do nome sobre círculo colorido (`.av`) —
  // nunca um ícone. Usa a cor customizada da party quando houver; senão cai
  // no accent padrão do tema (mesmo tratamento do frame).
  const preset = color ? getAccentPreset(color as AccentColorKey, mode) : null;

  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: preset ? preset.subtle : "accent.primarySubtle",
        color: preset ? preset.primary : "accent.primary",
        fontWeight: 600,
        fontSize,
        flexShrink: 0,
      }}
    >
      {initial}
    </Avatar>
  );
}
