"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountMemberRole } from "@prisma/client";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useSnackbar } from "notistack";

import { deleteMonthAction } from "@/actions/months";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { useExportDownload } from "@/lib/hooks/use-export-download";
import { useMonthFilters } from "./MonthFilterContext";
import { CreateMonthModal } from "./CreateMonthModal";
import { TransactionFilterDrawer } from "@/components/transactions/TransactionFilterDrawer";
import { DialogShell } from "@/components/ui/DialogShell";
import { MoneyValue } from "@/components/ui/MoneyValue";
import { MonthPickerNav } from "@/components/ui/MonthPickerNav";

type MonthItem = { id: string; year: number; month: number };

type Props = {
  accountId: string;
  currentMonth: MonthItem;
  months: MonthItem[];
  role: AccountMemberRole;
  monthTotal?: string;
  hasTransactions?: boolean;
};

export function MonthHeader({
  accountId,
  currentMonth,
  months,
  role,
  monthTotal,
  hasTransactions = false,
}: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { download: exportDownload, loading: exportLoading } = useExportDownload();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);

  const { activeCount } = useMonthFilters();

  const sortedMonths = [...months].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );
  const lastMonth = sortedMonths[sortedMonths.length - 1];

  const currentLabel = formatMonthLabel(currentMonth.year, currentMonth.month);
  const isOwner = role === "owner";

  const csvUrl = `/api/v1/accounts/${accountId}/months/${currentMonth.id}/export/csv`;
  const pdfUrl = `/api/v1/accounts/${accountId}/months/${currentMonth.id}/export/pdf`;

  async function handleExport(url: string) {
    setMenuAnchor(null);
    await exportDownload(url);
  }

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
      <MonthPickerNav
        currentMonth={currentMonth}
        months={months}
        basePath={`/${accountId}/months`}
      />

      {/* Total do mês em destaque */}
      {monthTotal !== undefined && (
        <Box sx={{ ml: 1 }}>
          <MoneyValue cents={BigInt(monthTotal)} variant="subtitle1" />
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      {/* Botão de filtros */}
      <Tooltip title={m.transactions.filters.title}>
        <IconButton
          size="small"
          aria-label="Filtros"
          onClick={(e) => setFilterAnchorEl(e.currentTarget)}
        >
          <Badge badgeContent={activeCount} color="primary" max={9}>
            <FilterAltIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <TransactionFilterDrawer anchorEl={filterAnchorEl} onClose={() => setFilterAnchorEl(null)} />

      {/* Botão novo mês */}
      <CreateMonthModal accountId={accountId} lastMonth={lastMonth ?? null} variant="button" />

      {/* Menu ellipsis — exportar para todos, deletar apenas para owner */}
      <IconButton
        size="small"
        aria-label="Mais opções"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        disabled={exportLoading}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        <MenuItem
          onClick={() => handleExport(csvUrl)}
          disabled={exportLoading}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <FileDownloadIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.export.csvOption}
        </MenuItem>
        <MenuItem
          onClick={() => handleExport(pdfUrl)}
          disabled={exportLoading}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <PictureAsPdfIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.export.pdfOption}
        </MenuItem>
        {isOwner && <Divider />}
        {isOwner && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteConfirm("");
              setDeleteOpen(true);
            }}
            sx={{ py: 0.75, fontSize: 13, color: "error.main" }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <DeleteOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />
            </ListItemIcon>
            {m.months.deleteTitle}
          </MenuItem>
        )}
      </Menu>

      {/* Delete confirmation */}
      <DialogShell
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="sm"
        title={m.months.deleteTitle}
        loading={deleting}
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
            <Button
              color="error"
              variant="contained"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== currentLabel}
            >
              {m.months.deleteTitle}
            </Button>
          </>
        }
      >
        <Stack spacing={layout.stack}>
          {hasTransactions && (
            <Alert variant="standard" sx={{ fontSize: "0.77rem", py: 0 }} severity="warning">
              {m.months.deleteWithTransactionsWarning}
            </Alert>
          )}
          <Typography variant="body2">{m.months.deleteConfirm}</Typography>
          <TextField
            label={`Digite "${currentLabel}" para confirmar`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </DialogShell>
    </Box>
  );
}
