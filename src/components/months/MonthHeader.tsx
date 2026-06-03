"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountMemberRole } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useSnackbar } from "notistack";

import { deleteMonthAction } from "@/actions/months";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";
import { CreateMonthModal } from "./CreateMonthModal";

type MonthItem = { id: string; year: number; month: number };

type Props = {
  accountId: string;
  currentMonth: MonthItem;
  months: MonthItem[];
  role: AccountMemberRole;
};

export function MonthHeader({ accountId, currentMonth, months, role }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<null | HTMLElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const sortedMonths = [...months].sort(
    (a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month,
  );
  const currentIndex = sortedMonths.findIndex((m) => m.id === currentMonth.id);
  const prevMonth = currentIndex > 0 ? sortedMonths[currentIndex - 1] : null;
  const nextMonth = currentIndex < sortedMonths.length - 1 ? sortedMonths[currentIndex + 1] : null;
  const lastMonth = sortedMonths[sortedMonths.length - 1];

  const currentLabel = formatMonthLabel(currentMonth.year, currentMonth.month);
  const isOwner = role === "owner";

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMonthAction(accountId, { monthId: currentMonth.id });
    setDeleting(false);

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }

    setDeleteOpen(false);
    enqueueSnackbar(m.months.deleteSuccess, { variant: "success" });

    const remaining = sortedMonths.filter((m) => m.id !== currentMonth.id);
    if (remaining.length > 0) {
      const latest = remaining[remaining.length - 1];
      router.push(`/${accountId}/months/${latest.id}`);
    } else {
      router.push(`/${accountId}`);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 3,
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Seta anterior */}
      <Tooltip title={prevMonth ? formatMonthLabel(prevMonth.year, prevMonth.month) : ""}>
        <span>
          <IconButton
            size="small"
            disabled={!prevMonth}
            onClick={() => prevMonth && router.push(`/${accountId}/months/${prevMonth.id}`)}
          >
            <ChevronLeftIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Dropdown de meses */}
      <Button
        variant="text"
        size="small"
        onClick={(e) => setDropdownAnchor(e.currentTarget)}
        sx={{ fontWeight: "bold", fontSize: "1.1rem", minWidth: 120 }}
      >
        {currentLabel}
      </Button>

      <Menu
        anchorEl={dropdownAnchor}
        open={!!dropdownAnchor}
        onClose={() => setDropdownAnchor(null)}
      >
        {[...sortedMonths].reverse().map((month) => (
          <MenuItem
            key={month.id}
            selected={month.id === currentMonth.id}
            onClick={() => {
              setDropdownAnchor(null);
              if (month.id !== currentMonth.id) {
                router.push(`/${accountId}/months/${month.id}`);
              }
            }}
          >
            <ListItemText primary={formatMonthLabel(month.year, month.month)} />
          </MenuItem>
        ))}
      </Menu>

      {/* Seta próximo */}
      <Tooltip title={nextMonth ? formatMonthLabel(nextMonth.year, nextMonth.month) : ""}>
        <span>
          <IconButton
            size="small"
            disabled={!nextMonth}
            onClick={() => nextMonth && router.push(`/${accountId}/months/${nextMonth.id}`)}
          >
            <ChevronRightIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {/* Botão novo mês */}
      <CreateMonthModal
        accountId={accountId}
        lastMonth={lastMonth ?? null}
        variant="button"
      />

      {/* Menu ellipsis (owner only) */}
      {isOwner && (
        <>
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setDeleteConfirm("");
                setDeleteOpen(true);
              }}
              sx={{ color: "error.main" }}
            >
              {m.months.deleteTitle}
            </MenuItem>
          </Menu>
        </>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{m.months.deleteTitle}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <DialogContentText>{m.months.deleteConfirm}</DialogContentText>
          <TextField
            label={`Digite "${currentLabel}" para confirmar`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting || deleteConfirm !== currentLabel}
          >
            {m.months.deleteTitle}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
