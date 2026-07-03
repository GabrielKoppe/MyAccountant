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
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";

import { getAccentPreset, type AccentColorKey } from "@/lib/accent-colors";
import { type PersonaIconKey } from "@/lib/persona-icons";
import type { ResponsiblePartyKind } from "./types";

/** Chave de ícone → componente MUI (variantes Outlined, visual discreto). */
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

/** Ícone default por tipo, quando a party não escolheu um. */
function defaultIconForKind(kind: ResponsiblePartyKind): SvgIconComponent {
  if (kind === "group") return PeopleOutlinedIcon;
  if (kind === "external") return PersonAddAltOutlinedIcon;
  return PersonOutlinedIcon;
}

type Props = {
  kind: ResponsiblePartyKind;
  icon: string | null;
  color: string | null;
  /** Foto do usuário (só personal com login). Tem prioridade sobre o ícone. */
  imageUrl?: string | null;
  name: string;
  /** Diâmetro em px. Default 24 (linha compacta). */
  size?: number;
};

/**
 * Avatar visual de uma party (Spec 60): foto → círculo colorido com ícone → default por tipo.
 * Discreto e reutilizável (seletor, coluna da transação, detalhe, configurações).
 */
export function PartyAvatar({ kind, icon, color, imageUrl, name, size = 24 }: Props) {
  const theme = useTheme();
  const mode = theme.palette.mode;

  // 1) Foto do usuário, quando houver.
  if (imageUrl) {
    return (
      <Avatar
        src={imageUrl}
        alt={name}
        sx={{ width: size, height: size, fontSize: size * 0.5, flexShrink: 0 }}
      >
        {name.charAt(0).toUpperCase()}
      </Avatar>
    );
  }

  // 2) Ícone (escolhido ou default por tipo) dentro de círculo colorido.
  const IconComp =
    (icon && PERSONA_ICON_COMPONENTS[icon as PersonaIconKey]) || defaultIconForKind(kind);

  const preset = color ? getAccentPreset(color as AccentColorKey, mode) : null;
  const bg = preset ? preset.subtle : theme.palette.action.hover;
  const fg = preset ? preset.primary : theme.palette.text.secondary;

  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: bg,
        color: fg,
        flexShrink: 0,
      }}
    >
      <IconComp sx={{ fontSize: size * 0.62 }} />
    </Avatar>
  );
}
