"use client";

import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import type { RowMenuItem } from "./types";

type Props = {
  anchorEl: HTMLElement | null;
  items: RowMenuItem[];
  onClose: () => void;
};

/**
 * Menu ⋮ único da tabela de transações. Uma instância vive no TransactionTable;
 * o conteúdo (`items`) é fornecido pela linha que o abre (desenho b da spec 62).
 * Acabamento fiel à Spec 66 §8: 220px, borda + sem sombra (DS: bordas, não
 * sombras), itens compactos com ícone 16px `text.secondary`.
 */
export function RowActionsMenu({ anchorEl, items, onClose }: Props) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={!!anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{
        paper: {
          sx: {
            width: 220,
            border: 1,
            borderColor: "border.subtle",
            borderRadius: 1.25, // 10px (shape.borderRadius=8 × 1.25)
            boxShadow: "none", // DS: bordas, não sombras
            p: 1.5, // 6px
          },
        },
        list: { sx: { py: 0 } },
      }}
    >
      {items.flatMap((item, i) => [
        item.dividerBefore ? (
          <Divider key={`d-${i}`} sx={{ my: 1, mx: 2, borderColor: "border.subtle" }} />
        ) : null,
        <MenuItem
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          sx={{
            gap: 2.5, // 10px
            py: 2, // 8px
            px: 3, // 12px
            fontWeight: 400,
            fontSize: "0.82rem",
            borderRadius: 1, // 8px — casa com o radius do container
            ...(item.danger ? { color: "danger.main" } : {}),
          }}
        >
          <ListItemIcon
            sx={{ minWidth: 0, color: "text.secondary", ...(item.danger ? { color: "danger.main" } : {}) }}
          >
            {item.icon}
          </ListItemIcon>
          {item.label}
        </MenuItem>,
      ])}
    </Menu>
  );
}
