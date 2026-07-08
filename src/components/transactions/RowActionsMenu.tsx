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
 */
export function RowActionsMenu({ anchorEl, items, onClose }: Props) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={!!anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      {items.flatMap((item, i) => [
        item.dividerBefore ? <Divider key={`d-${i}`} /> : null,
        <MenuItem
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          sx={{ py: 0.75, fontSize: 13, ...(item.danger ? { color: "danger.main" } : {}) }}
        >
          <ListItemIcon sx={{ minWidth: 32, ...(item.danger ? { color: "danger.main" } : {}) }}>
            {item.icon}
          </ListItemIcon>
          {item.label}
        </MenuItem>,
      ])}
    </Menu>
  );
}
