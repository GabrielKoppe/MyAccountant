"use client";

import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import type { SvgIconProps } from "@mui/material";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import type { SectionCountType } from "@prisma/client";
import type { ComponentType } from "react";

import { m } from "@/lib/messages";

/**
 * Spec 68 D1 — os quatro valores REAIS de `Section.countType`, sem enum novo:
 * este campo já decide o sinal do valor no total do mês e é lido por ~55
 * arquivos. `Record` exaustivo de propósito — esquecer um valor aqui é erro de
 * compilação, não um chip mudo em produção (critério de teste §8).
 */
const KIND_ICONS: Record<SectionCountType, ComponentType<SvgIconProps>> = {
  subtract: NorthEastIcon,
  add: SouthWestIcon,
  neutral: SwapHorizIcon,
  ignore: DoNotDisturbOnOutlinedIcon,
};

type Props = {
  countType: SectionCountType;
};

/**
 * Pílula de tipo de seção (Spec 68 §2.1 item 2 / §7.4).
 *
 * SEMPRE o mesmo estilo neutro nos quatro valores — o tipo é comunicado pelo
 * ícone e pelo texto, nunca pela cor do chip. A cor já é a identidade da seção
 * (ver `ColorDot`); usar cor aqui também duplicaria informação e voltaria a
 * misturar "o que a seção É" com "que tipo de valor ela conta".
 */
export function SectionKindChip({ countType }: Props) {
  const Icon = KIND_ICONS[countType];
  const label = m.settings.structure.sections.kindLabels[countType];
  const hint = m.settings.structure.sections.kindHints[countType];

  return (
    <Tooltip title={hint}>
      <Chip size="small" icon={<Icon sx={{ fontSize: 14 }} />} label={label} />
    </Tooltip>
  );
}
