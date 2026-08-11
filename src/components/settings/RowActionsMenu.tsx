"use client";

import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { m } from "@/lib/messages";

import {
  SETTINGS_MENU_ITEM_SX,
  SETTINGS_MENU_SLOT_PROPS,
} from "./table/settings-menu-props";

export type RowAction = "edit" | "duplicate" | "toggleActive" | "viewUsage" | "merge" | "delete";

/**
 * Ordem canônica e IMUTÁVEL do menu da linha (Spec 67 §2.6): Editar · Duplicar ·
 * Ativar/desativar · Ver uso · Mesclar · Excluir — a mesma em toda página de Configurações.
 *
 * O componente ITERA esta constante, então a ordem das chaves no objeto `actions` é
 * irrelevante: quem chama não consegue alterar a sequência por acidente. As Specs 68–72
 * importam daqui em vez de reescrever a ordem.
 */
export const ROW_ACTION_ORDER = [
  "edit",
  "duplicate",
  "toggleActive",
  "viewUsage",
  "merge",
  "delete",
] as const satisfies readonly RowAction[];

// A MEDIDA do ícone vem de `SETTINGS_MENU_ITEM_SX` (seletor descendente, que é o
// único que vence o default do MUI). Aqui fica só a cor do item destrutivo.
const DANGER_ICON_SX = { color: "danger.main" } as const;

/**
 * Rótulo + ícone de cada ação. `toggleActive` é a única que depende do estado: o item
 * nomeia o EFEITO do clique ("Desativar" quando está ativo), não o estado atual.
 */
function actionMeta(action: RowAction, active: boolean): { label: string; icon: ReactNode } {
  const t = m.settings.shell.rowMenu;
  switch (action) {
    case "edit":
      return { label: t.edit, icon: <EditOutlinedIcon /> };
    case "duplicate":
      return { label: t.duplicate, icon: <ContentCopyOutlinedIcon /> };
    case "toggleActive":
      return active
        ? { label: t.deactivate, icon: <ToggleOffIcon /> }
        : { label: t.activate, icon: <ToggleOnIcon /> };
    case "viewUsage":
      return { label: t.viewUsage, icon: <VisibilityOutlinedIcon /> };
    case "merge":
      return { label: t.merge, icon: <MergeTypeIcon /> };
    case "delete":
      // `color="error"` não é aplicável a MenuItem (não é PaletteColor lá); o tom
      // destrutivo vem do token `danger.main` via sx, no rótulo e no ícone.
      return {
        label: t.delete,
        icon: <DeleteOutlineIcon sx={DANGER_ICON_SX} />,
      };
  }
}

type Props = {
  /** só as ações aplicáveis a este objeto; as ausentes NÃO são renderizadas */
  actions: Partial<Record<RowAction, () => void>>;
  /** estado atual — decide se o item mostra "Ativar" ou "Desativar" */
  active?: boolean;
  /** nome do objeto, para o aria-label do gatilho */
  name: string;
};

/**
 * Menu de elipses padronizado das linhas de Configurações (Spec 67 §2.6).
 *
 * Regra dura: item inaplicável **some** — nunca aparece desabilitado. Um menu com
 * metade dos itens em cinza ensina o usuário a ignorar o menu inteiro.
 */
export function RowActionsMenu({ actions, active = true, name }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerId = useId();
  const menuId = useId();
  const open = Boolean(anchorEl);

  // Filtra pela existência do callback (e não por `key in actions`): um `{ edit: undefined }`
  // vindo de um ternário no chamador conta como ação ausente.
  const items = ROW_ACTION_ORDER.filter((action) => typeof actions[action] === "function");

  // Sem nenhuma ação aplicável não há o que oferecer — nem o gatilho é renderizado.
  if (items.length === 0) return null;

  const handleSelect = (action: RowAction) => {
    setAnchorEl(null);
    actions[action]?.();
  };

  // Lista PLANA de filhos (sem Fragment): o MenuList do MUI inspeciona os filhos diretos
  // para gerenciar foco de teclado, e um Fragment envolvendo MenuItem quebra isso.
  const menuItems: ReactNode[] = [];
  for (const [index, action] of items.entries()) {
    // "Excluir" é sempre a última e fica separada das não destrutivas. Se for o único
    // item, a divisória é omitida — não haveria nada acima dela para separar.
    if (action === "delete" && index > 0) {
      menuItems.push(<Divider key="delete-divider" />);
    }
    const { label, icon } = actionMeta(action, active);
    menuItems.push(
      <MenuItem
        key={action}
        onClick={() => handleSelect(action)}
        // Densidade compartilhada por TODOS os menus de Configurações — ver
        // `settings-menu-props.ts` (inclusive a armadilha de especificidade do ícone).
        sx={{
          ...SETTINGS_MENU_ITEM_SX,
          ...(action === "delete" ? { color: "danger.main" } : {}),
        }}
      >
        <ListItemIcon sx={{ minWidth: 26 }}>{icon}</ListItemIcon>
        {label}
      </MenuItem>,
    );
  }

  return (
    <>
      <IconButton
        id={triggerId}
        size="small"
        aria-label={`${m.settings.shell.rowMenu.trigger}: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // A linha inteira costuma ser clicável (abre o detalhe / entra em edição);
          // o clique no ⋮ não pode vazar para ela.
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
      >
        {/* Pequeno e cinza, como no frame. `fontSize="small"` do MUI dá 20px e a cor
            default do IconButton é a do texto (branco no dark) — o atalho de ações
            ficava com mais peso visual que o nome do objeto na mesma linha. */}
        <MoreHorizIcon sx={{ fontSize: 16, color: "text.tertiary" }} />
      </IconButton>

      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          ...SETTINGS_MENU_SLOT_PROPS,
          list: { ...SETTINGS_MENU_SLOT_PROPS.list, "aria-labelledby": triggerId },
        }}
      >
        {menuItems}
      </Menu>
    </>
  );
}
