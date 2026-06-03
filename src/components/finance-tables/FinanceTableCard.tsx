"use client";

import { useMemo, useState, useTransition } from "react";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TableChartIcon from "@mui/icons-material/TableChart";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useSnackbar } from "notistack";

import { deleteFinanceTableAction, updateFinanceTableAction } from "@/actions/finance-tables";
import { createFromTableAction } from "@/actions/table-templates";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { applyGlobalFilters, useMonthFilters } from "@/components/months/MonthFilterContext";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow,
} from "@/components/transactions/types";

type TableData = {
  id: string;
  name: string;
  tableTypeName: string | null;
  countInMonth: boolean;
  total: string;
  transactionCount: number;
  hiddenColumns: HiddenColumns;
};

type Props = {
  table: TableData;
  accountId: string;
  monthId: string;
  sectionIsActive: boolean;
  sectionCountType: SectionCountType;
  transactions: TransactionRow[];
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  defaultResponsibleUserId: string | null;
  onDuplicate: () => void;
};

export function FinanceTableCard({
  table,
  accountId,
  monthId,
  sectionIsActive,
  sectionCountType,
  transactions,
  categories,
  institutions,
  members,
  defaultResponsibleUserId,
  onDuplicate,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [collapsed, setCollapsed] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(table.name);
  const [showNewRow, setShowNewRow] = useState(false);
  const [saveModelOpen, setSaveModelOpen] = useState(false);
  const [modelName, setModelName] = useState(table.name);
  const [isPending, startTransition] = useTransition();

  const { filters, isActive: hasGlobalFilters } = useMonthFilters();

  const total = BigInt(table.total);
  const isReadOnly = !sectionIsActive;
  // Em seções subtract, positivo = despesa (vermelho) e negativo = estorno (verde)
  const totalIsPositive = sectionCountType === "subtract" ? total < 0n : total >= 0n;
  const typeLabel = table.tableTypeName;

  const filteredTotal = useMemo(() => {
    if (!hasGlobalFilters) return null;
    const filtered = applyGlobalFilters(transactions, filters);
    return filtered.reduce((sum, tx) => sum + BigInt(tx.amountCents), 0n);
  }, [transactions, filters, hasGlobalFilters]);

  function handleToggleCount() {
    startTransition(async () => {
      const result = await updateFinanceTableAction(accountId, {
        tableId: table.id,
        countInMonth: !table.countInMonth,
      });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
    });
  }

  async function handleRename() {
    if (!newName.trim()) return;
    const result = await updateFinanceTableAction(accountId, {
      tableId: table.id,
      name: newName.trim(),
    });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    enqueueSnackbar(m.financeTables.updated, { variant: "success" });
    setRenameOpen(false);
  }

  function handleSaveAsModel() {
    if (!modelName.trim()) return;
    startTransition(async () => {
      const result = await createFromTableAction(accountId, {
        tableId: table.id,
        name: modelName.trim(),
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(
        `Modelo "${result.data.name}" salvo com ${result.data._count.items} item(ns).`,
        { variant: "success" },
      );
      setSaveModelOpen(false);
    });
  }

  function confirmDelete() {
    setDeleteOpen(false);
    startTransition(async () => {
      const result = await deleteFinanceTableAction(accountId, { tableId: table.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
      } else {
        enqueueSnackbar(m.financeTables.deleted, { variant: "success" });
      }
    });
  }

  return (
    <Paper variant="outlined" sx={{ mb: 2, overflow: "hidden" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1.5,
          gap: 3,
          borderBottom: collapsed ? 0 : 1,
          borderColor: "divider",
          bgcolor: "background.default",
        }}
      >
        <Tooltip title={collapsed ? "Expandir" : "Recolher"}>
          <IconButton size="small" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
          <Typography fontWeight="medium" noWrap>
            {table.name}
          </Typography>
          {typeLabel && <Chip label={typeLabel} size="small" variant="outlined" />}
          {!table.countInMonth && (
            <Chip label="não conta" size="small" color="default" variant="outlined" />
          )}
          {isReadOnly && (
            <Chip label="somente leitura" size="small" color="warning" variant="outlined" />
          )}
        </Box>

        <Box sx={{ textAlign: "right", minWidth: 120 }}>
          <Typography fontWeight="bold" color={totalIsPositive ? "success.main" : "error.main"}>
            {formatCentsToBrl(total)}
          </Typography>
          {filteredTotal !== null && (
            <Box
              sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}
            >
              <Typography variant="caption" color="warning.main" fontWeight={500}>
                {formatCentsToBrl(filteredTotal)}
              </Typography>
              <Typography variant="caption" color="text.tertiary">
                {m.transactions.filters.filteredLabel}
              </Typography>
              {total !== 0n && (
                <Typography variant="caption" color="text.tertiary">
                  · {Math.round((Math.abs(Number(filteredTotal)) / Math.abs(Number(total))) * 100)}%
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {!isReadOnly && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setCollapsed(false);
                setShowNewRow(true);
              }}
              disabled={isPending}
            >
              {m.transactions.newTransaction}
            </Button>

            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              disabled={isPending}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>

      {/* Ellipsis menu */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setNewName(table.name);
            setRenameOpen(true);
          }}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          {m.financeTables.menuRename}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            handleToggleCount();
          }}
        >
          <ListItemIcon>
            <Switch size="small" checked={table.countInMonth} readOnly tabIndex={-1} />
          </ListItemIcon>
          {m.financeTables.countInMonthLabel}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setModelName(table.name);
            setSaveModelOpen(true);
          }}
        >
          <ListItemIcon>
            <TableChartIcon fontSize="small" />
          </ListItemIcon>
          {m.tableModels.createFromTableButton}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDuplicate();
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          {m.financeTables.menuDuplicate}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          {m.financeTables.menuDelete}
        </MenuItem>
      </Menu>

      {/* Body */}
      <Collapse in={!collapsed}>
        <TransactionTable
          tableId={table.id}
          monthId={monthId}
          accountId={accountId}
          sectionIsActive={sectionIsActive}
          sectionCountType={sectionCountType}
          hiddenColumns={table.hiddenColumns}
          initialTransactions={transactions}
          categories={categories}
          institutions={institutions}
          members={members}
          defaultResponsibleUserId={defaultResponsibleUserId}
          showNewRow={showNewRow}
          onNewRowClose={() => setShowNewRow(false)}
        />
      </Collapse>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{m.financeTables.editTitle}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label={m.financeTables.nameLabel}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRename();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameOpen(false)}>{m.common.cancel}</Button>
          <Button variant="contained" onClick={handleRename}>
            {m.common.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{m.financeTables.menuDelete}</DialogTitle>
        <DialogContent>
          <DialogContentText>{m.financeTables.deleteConfirm}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={isPending}>
            {m.common.delete}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save as model dialog */}
      <Dialog open={saveModelOpen} onClose={() => setSaveModelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{m.tableModels.saveAsModelTitle}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label={m.tableModels.nameLabel}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            fullWidth
            autoFocus
            helperText="As transações atuais serão salvas como itens do modelo."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveAsModel();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveModelOpen(false)}>{m.common.cancel}</Button>
          <Button
            variant="contained"
            onClick={handleSaveAsModel}
            disabled={isPending || !modelName.trim()}
          >
            Salvar modelo
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
