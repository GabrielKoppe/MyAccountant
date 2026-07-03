"use client";

import { useMemo, useState, useTransition } from "react";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";

import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";

import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TableChartIcon from "@mui/icons-material/TableChart";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import RestoreIcon from "@mui/icons-material/Restore";
import { useSnackbar } from "notistack";

import { deleteFinanceTableAction, updateFinanceTableAction } from "@/actions/finance-tables";
import { createFromTableAction } from "@/actions/table-templates";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { useRouter } from "next/navigation";
import { CreateInstallmentDialog } from "@/components/installments/CreateInstallmentDialog";

import { applyGlobalFilters, useMonthFilters } from "@/components/months/MonthFilterContext";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { ExpandableIconButton } from "@/components/ui/ExpandableIconButton";

import {
  FinanceTableChangeTypeDialog,
  FinanceTableDeleteDialog,
  FinanceTableRenameDialog,
  FinanceTableSaveModelDialog,
} from "./FinanceTableCardDialogs";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow,
} from "@/components/transactions/types";

type TableData = {
  id: string;
  name: string;
  tableTypeId: string | null;
  tableTypeName: string | null;
  countInMonth: boolean;
  groupByDate: boolean;
  total: string;
  transactionCount: number;
  hiddenColumns: HiddenColumns;
};

type TableTypeOption = { id: string; name: string; isDefault: boolean };

type Props = {
  table: TableData;
  accountId: string;
  monthId: string;
  currentUserId: string;
  canEdit: boolean;
  timezone: string;
  sectionIsActive: boolean;
  sectionCountType: SectionCountType;
  tableTypes: TableTypeOption[];
  transactions: TransactionRow[];
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  defaultResponsiblePartyId: string | null;
  onDuplicate: () => void;
};

export function FinanceTableCard({
  table,
  accountId,
  monthId,
  currentUserId,
  canEdit,
  timezone,
  sectionIsActive,
  sectionCountType,
  tableTypes,
  transactions,
  categories,
  institutions,
  members,
  parties,
  defaultResponsiblePartyId,
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
  const [changeTypeOpen, setChangeTypeOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(table.tableTypeId ?? "");
  const [changingType, setChangingType] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const router = useRouter();
  // Estado para o botão "Voltar à visualização padrão"
  const [hasCustomSort, setHasCustomSort] = useState(false);
  const [resetSortSignal, setResetSortSignal] = useState(0);

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

  function handleToggleGroupByDate() {
    startTransition(async () => {
      const result = await updateFinanceTableAction(accountId, {
        tableId: table.id,
        groupByDate: !table.groupByDate,
      });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
    });
  }

  async function handleRename() {
    if (!newName.trim()) return;
    setRenaming(true);
    try {
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
    } finally {
      setRenaming(false);
    }
  }

  async function handleChangeType() {
    if (!selectedTypeId || selectedTypeId === table.tableTypeId) {
      setChangeTypeOpen(false);
      return;
    }
    setChangingType(true);
    try {
      const result = await updateFinanceTableAction(accountId, {
        tableId: table.id,
        tableTypeId: selectedTypeId,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(m.financeTables.updated, { variant: "success" });
      setChangeTypeOpen(false);
    } finally {
      setChangingType(false);
    }
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
      enqueueSnackbar(m.tableModels.applied, { variant: "success" });
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
    <Paper
      variant="outlined"
      id={`table-${table.id}`}
      sx={{ mb: 2, overflow: "hidden", scrollMarginTop: 80 }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1.5,
          gap: 2,
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
          {/* Botão "Voltar à visualização padrão" — só aparece quando há ordenação personalizada */}
          {hasCustomSort && (
            <ExpandableIconButton
              icon={<RestoreIcon sx={{ fontSize: 16 }} />}
              label={m.financeTables.resetSort}
              onClick={() => setResetSortSignal((n) => n + 1)}
              sx={{ color: "text.secondary" }}
            />
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
            {/* ButtonGroup: botão principal + dropdown para ações adicionais */}
            <ButtonGroup size="small" variant="outlined" disabled={isPending}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  setCollapsed(false);
                  setShowNewRow(true);
                }}
              >
                {m.transactions.newTransaction}
              </Button>
              <Button
                sx={{ px: 0.5, minWidth: 28 }}
                onClick={(e) => setAddMenuAnchor(e.currentTarget)}
                aria-label="Mais opções de criação"
              >
                <ArrowDropDownIcon fontSize="small" />
              </Button>
            </ButtonGroup>

            {/* Menu do ButtonGroup dropdown */}
            <Menu
              anchorEl={addMenuAnchor}
              open={Boolean(addMenuAnchor)}
              onClose={() => setAddMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{ paper: { sx: { minWidth: 210 } } }}
            >
              <MenuItem
                onClick={() => {
                  setAddMenuAnchor(null);
                  setCollapsed(false);
                  setInstallmentDialogOpen(true);
                }}
                sx={{ py: 0.75, fontSize: 14, gap: 2 }}
              >
                <CallSplitIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                {m.transactions.installments.newInstallment}
              </MenuItem>
            </Menu>

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
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setNewName(table.name);
            setRenameOpen(true);
          }}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DriveFileRenameOutlineIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.financeTables.menuRename}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setSelectedTypeId(table.tableTypeId ?? "");
            setChangeTypeOpen(true);
          }}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ViewColumnOutlinedIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.financeTables.menuChangeType}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            handleToggleCount();
          }}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {table.countInMonth ? (
              <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            ) : (
              <AddCircleOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            )}
          </ListItemIcon>
          {table.countInMonth ? "Excluir do total do mês" : "Incluir no total do mês"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            handleToggleGroupByDate();
          }}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <CalendarTodayOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          </ListItemIcon>
          {table.groupByDate ? m.financeTables.groupByDateOff : m.financeTables.groupByDateOn}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setModelName(table.name);
            setSaveModelOpen(true);
          }}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <TableChartIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.tableModels.createFromTableButton}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDuplicate();
          }}
          sx={{ py: 0.75, fontSize: 13 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.financeTables.menuDuplicate}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
          sx={{ py: 0.75, fontSize: 13, color: "error.main" }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} color="error" />
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
          currentUserId={currentUserId}
          canEdit={canEdit}
          timezone={timezone}
          sectionIsActive={sectionIsActive}
          sectionCountType={sectionCountType}
          hiddenColumns={table.hiddenColumns}
          initialTransactions={transactions}
          categories={categories}
          institutions={institutions}
          members={members}
          parties={parties}
          defaultResponsiblePartyId={defaultResponsiblePartyId}
          showNewRow={showNewRow}
          onNewRowClose={() => setShowNewRow(false)}
          groupByDate={table.groupByDate}
          onSortActiveChange={setHasCustomSort}
          resetSortSignal={resetSortSignal}
        />
      </Collapse>

      {/* Rename dialog */}
      <FinanceTableRenameDialog
        open={renameOpen}
        loading={renaming}
        name={newName}
        onChangeName={setNewName}
        onClose={() => setRenameOpen(false)}
        onConfirm={handleRename}
      />

      {/* Change type dialog */}
      <FinanceTableChangeTypeDialog
        open={changeTypeOpen}
        loading={changingType}
        tableTypes={tableTypes}
        tableTypeId={selectedTypeId}
        onChangeTableTypeId={setSelectedTypeId}
        onClose={() => setChangeTypeOpen(false)}
        onConfirm={handleChangeType}
      />

      {/* Delete dialog */}
      <FinanceTableDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />

      {/* Save as model dialog */}
      <FinanceTableSaveModelDialog
        open={saveModelOpen}
        loading={isPending}
        modelName={modelName}
        onChangeModelName={setModelName}
        onClose={() => setSaveModelOpen(false)}
        onConfirm={handleSaveAsModel}
      />

      {/* Installment dialog */}
      <CreateInstallmentDialog
        open={installmentDialogOpen}
        onClose={() => setInstallmentDialogOpen(false)}
        onCreated={() => {
          setInstallmentDialogOpen(false);
          router.refresh();
        }}
        accountId={accountId}
        tableId={table.id}
      />
    </Paper>
  );
}
