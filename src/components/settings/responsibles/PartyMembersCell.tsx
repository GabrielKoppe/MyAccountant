"use client";

import AddIcon from "@mui/icons-material/Add";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import AvatarGroup from "@mui/material/AvatarGroup";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useId, useState } from "react";

import { PartyAvatar } from "@/components/transactions/PartyAvatar";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import {
  SETTINGS_MENU_ITEM_SX,
  SETTINGS_MENU_SLOT_PROPS,
} from "../table/settings-menu-props";

const st = m.settings.structure.responsibles;

/** Um membro já vinculado — cor/foto vêm do `ResponsibleParty` pessoal dele (mesma identidade usada em toda a app). */
export type LinkedMember = {
  userId: string;
  label: string;
  color: string | null;
  imageUrl: string | null;
};

/** Um membro da conta ainda não vinculado — universo do menu do botão `+`. */
export type AvailableMember = { userId: string; label: string };

type Props = {
  /** Nome do responsável — compõe o aria-label do botão de vincular (Spec 68 §2.4). */
  partyName: string;
  members: LinkedMember[];
  availableMembers: AvailableMember[];
  onLink: (userId: string) => void;
  disabled?: boolean;
  /**
   * `kind: "personal"` — o vínculo é fixo (o próprio membro da conta). A célula troca
   * o botão "+" por um cadeado discreto: sem coluna nova, só um indicativo de que
   * este vínculo é automático e não aceita vincular/desvincular pela mão do usuário
   * ("Tudo é responsável" — só `personal` fica de fora do 0..N livre).
   */
  locked?: boolean;
};

/**
 * Célula "Membros vinculados" das linhas de Responsáveis (Spec 68 §2.4 / §7.5,
 * revisão "Tudo é responsável").
 *
 * D4 relaxou o vínculo para 0..N em qualquer responsável comum (`group`) — é essa
 * mudança que faz "nenhum — só rótulo" existir de verdade. Com 1+ membros,
 * `AvatarGroup` + nomes; o botão `+` tracejado vincula sem abrir o modal de edição.
 * Para `personal` (`locked`), o "+" vira um cadeado: o vínculo é fixo com o membro
 * da conta e não aceita alteração manual.
 *
 * Desvincular NÃO tem atalho nesta célula (para quem não é `locked`): `PartyAvatar`
 * é reaproveitado sem alteração (Spec 68 §7.5), e ele não expõe `onClick` —
 * inventar um clique por avatar exigiria contornar esse componente ou quebrar o
 * `AvatarGroup` (que só clona `className`/`variant` dos filhos, então um wrapper de
 * Tooltip por avatar perde o CSS de sobreposição). Desvincular — inclusive até
 * zero, liberado pelo D4 — continua pelo checklist de membros do modal "Editar".
 */
export function PartyMembersCell({
  partyName,
  members,
  availableMembers,
  onLink,
  disabled,
  locked = false,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const open = Boolean(anchorEl);
  const canLink = availableMembers.length > 0;

  function handleLink(userId: string) {
    setAnchorEl(null);
    onLink(userId);
  }

  return (
    <Stack direction="row" spacing={layout.inline} alignItems="center" sx={{ minWidth: 0 }}>
      {members.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ fontStyle: "italic", color: "text.tertiary", whiteSpace: "nowrap" }}
        >
          {st.noMembers}
        </Typography>
      ) : (
        <>
          <AvatarGroup
            max={3}
            sx={{
              "& .MuiAvatar-root": {
                width: 22,
                height: 22,
                fontSize: "0.62rem",
                borderWidth: "1.5px",
              },
            }}
          >
            {members.map((member) => (
              // `kind` não influencia o render de `PartyAvatar` (só a cor/foto/inicial
              // importam) — "personal" aqui é só o valor exigido pelo tipo da prop.
              <PartyAvatar
                key={member.userId}
                kind="personal"
                icon={null}
                color={member.color}
                imageUrl={member.imageUrl}
                name={member.label}
                size={22}
              />
            ))}
          </AvatarGroup>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {members.map((member) => member.label).join(", ")}
          </Typography>
        </>
      )}

      {locked ? (
        // `personal`: vínculo fixo com o próprio membro — sem "+", sem menu. O
        // cadeado é o "indicativo discreto de automático" que a revisão pede, sem
        // abrir uma segunda coluna só para isso.
        <Tooltip title={st.autoLinked}>
          <LockOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0 }} />
        </Tooltip>
      ) : (
        <>
          <Tooltip title={canLink ? st.linkMember : st.allMembersLinked}>
            {/* `span`: Tooltip precisa de um filho com ref válido mesmo com o botão desabilitado. */}
            <span>
              <IconButton
                size="small"
                aria-label={st.linkMemberFor(partyName)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                disabled={disabled || !canLink}
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  color: "accent.primary",
                  // Longhand sempre (armadilha documentada no skill design-system): o
                  // shorthand `border` reseta a cor pra `currentColor` em contexto
                  // responsivo — aqui não há breakpoint, mas o padrão do projeto é
                  // nunca usar o shorthand quando `borderColor` é explícito.
                  borderWidth: "1px",
                  borderStyle: "dashed",
                  borderColor: "accent.primary",
                  "&.Mui-disabled": {
                    borderColor: "action.disabled",
                    color: "action.disabled",
                  },
                }}
              >
                <AddIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Menu
            id={menuId}
            anchorEl={anchorEl}
            open={open}
            onClose={() => setAnchorEl(null)}
            slotProps={SETTINGS_MENU_SLOT_PROPS}
          >
            {availableMembers.map((member) => (
              <MenuItem
                key={member.userId}
                onClick={() => handleLink(member.userId)}
                sx={SETTINGS_MENU_ITEM_SX}
              >
                {member.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Stack>
  );
}
