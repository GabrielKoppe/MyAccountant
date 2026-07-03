"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectProps } from "@mui/material/Select";
import Typography from "@mui/material/Typography";

import type { ResponsiblePartyKind, ResponsiblePartyOption } from "./types";
import { PartyAvatar } from "./PartyAvatar";
import { m } from "@/lib/messages";

const rp = m.settings.responsibleParties;

// Ordem semântica dos grupos + rótulo do subheader.
const KIND_ORDER: { kind: ResponsiblePartyKind; label: string }[] = [
  { kind: "personal", label: rp.kindPersonal },
  { kind: "group", label: rp.kindGroup },
  { kind: "external", label: rp.kindExternal },
];

/** Avatar (foto / ícone colorido / default) de uma party, para item e valor selecionado. */
function PartyGlyph({ party }: { party: ResponsiblePartyOption }) {
  return (
    <PartyAvatar
      kind={party.kind}
      icon={party.icon}
      color={party.color}
      imageUrl={party.imageUrl}
      name={party.name}
      size={20}
    />
  );
}

type Props = {
  value: string | null;
  onChange: (partyId: string | null) => void;
  parties: ResponsiblePartyOption[];
  /** Estilo do controle (repassa o sx do Select). */
  sx?: SelectProps["sx"];
  /** Variante do controle. Nas linhas de transação use "standard" para casar com as demais colunas. */
  variant?: SelectProps["variant"];
  autoFocus?: boolean;
  ariaLabel?: string;
};

/**
 * Seletor de responsável por persona (Spec 60). Lista as parties agrupadas por
 * kind (Pessoais → Grupos → Externos) com emoji/avatar. Para criar novas personas,
 * use Configurações → Responsáveis.
 */
export function ResponsiblePartySelect({
  value,
  onChange,
  parties,
  sx,
  variant,
  autoFocus,
  ariaLabel,
}: Props) {
  const byId = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  // Monta os itens agrupados; ListSubheader só quando o grupo tem itens.
  const groupedChildren = KIND_ORDER.flatMap(({ kind, label }) => {
    const inGroup = parties.filter((p) => p.kind === kind);
    if (inGroup.length === 0) return [];
    return [
      <ListSubheader key={`sub-${kind}`} sx={{ lineHeight: 2, fontSize: 12 }}>
        {label}
      </ListSubheader>,
      ...inGroup.map((party) => (
        <MenuItem key={party.id} value={party.id} sx={{ fontSize: 13 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <PartyGlyph party={party} />
            <Typography variant="body2" noWrap>
              {party.name}
            </Typography>
          </Box>
        </MenuItem>
      )),
    ];
  });

  return (
    <Select
      size="small"
      variant={variant}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value as string) || null)}
      autoFocus={autoFocus}
      displayEmpty
      inputProps={{ "aria-label": ariaLabel ?? m.transactions.fields.responsibleUser }}
      renderValue={(selected) => {
        const party = selected ? byId.get(selected as string) : null;
        if (!party) {
          return (
            <Typography component="span" variant="body2" sx={{ color: "text.tertiary" }}>
              {m.common.none}
            </Typography>
          );
        }
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <PartyGlyph party={party} />
            <Typography component="span" variant="body2" noWrap>
              {party.name}
            </Typography>
          </Box>
        );
      }}
      sx={{ fontSize: 13, ...sx }}
    >
      <MenuItem value="">
        <Typography component="em" variant="body2" sx={{ color: "text.tertiary" }}>
          {m.common.none}
        </Typography>
      </MenuItem>
      {groupedChildren}
    </Select>
  );
}
