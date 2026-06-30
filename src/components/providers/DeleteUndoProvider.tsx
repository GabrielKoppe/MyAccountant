"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import { useSnackbar } from "notistack";

import { deleteTransactionAction } from "@/actions/transactions";
import { m } from "@/lib/messages";
import type { TransactionRow as TxRow } from "@/components/transactions/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PendingDelete = {
  id: string;
  row: TxRow;
  accountId: string;
};

type RestoreCallback = (rows: TxRow[]) => void;

type DeleteUndoContextValue = {
  requestDelete: (id: string, row: TxRow, accountId: string) => void;
  registerRestoreCallback: (tableId: string, fn: RestoreCallback) => void;
  unregisterRestoreCallback: (tableId: string) => void;
};

// ─── Contexto ─────────────────────────────────────────────────────────────────

const DeleteUndoContext = createContext<DeleteUndoContextValue | null>(null);

const UNDO_TIMEOUT_MS = 10_000;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DeleteUndoProvider({ children }: { children: ReactNode }) {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  // Fila de deletes pendentes — nunca vai ao banco antes do TTL ou do beforeunload
  const pendingRef = useRef<PendingDelete[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackKeyRef = useRef<string | number | null>(null);

  // Callbacks de restauração registrados por cada TransactionTable montada
  const restoreCallbacksRef = useRef<Map<string, RestoreCallback>>(new Map());

  // ── Executa os hard deletes pendentes ──────────────────────────────────────
  const executePendingDeletes = useCallback(async () => {
    const batch = [...pendingRef.current];
    if (batch.length === 0) return;
    pendingRef.current = [];
    timerRef.current = null;

    const results = await Promise.all(
      batch.map(({ id, accountId }) => deleteTransactionAction(accountId, { transactionId: id })),
    );

    // Restaurar linhas que falharam ao deletar
    const failed = batch.filter((_, i) => !results[i]?.ok);
    if (failed.length > 0) {
      // Agrupar por tableId para restaurar na tabela certa
      // Como TxRow não tem tableId direto, usamos o tableId via prop da transaction
      // Notificar todas as tabelas registradas para restaurar as linhas que falharam
      const failedRows = failed.map((b) => b.row);
      restoreCallbacksRef.current.forEach((fn) => fn(failedRows));
      enqueueSnackbar(m.transactions.deleteError, { variant: "error" });
    }
  }, [enqueueSnackbar]);

  // ── beforeunload: dispara hard delete imediato se aba for fechada ──────────
  useEffect(() => {
    function handleBeforeUnload() {
      const batch = [...pendingRef.current];
      if (batch.length === 0) return;
      pendingRef.current = [];
      if (timerRef.current) clearTimeout(timerRef.current);

      // Usar sendBeacon não é possível com Server Actions; usar fetch síncrono também não.
      // A melhor opção segura é disparar os deletes via Promise.all mesmo sabendo que
      // o browser pode cancelar — é preferível a deixar dados fantasma.
      void Promise.all(
        batch.map(({ id, accountId }) => deleteTransactionAction(accountId, { transactionId: id })),
      );
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Desfazer delete ────────────────────────────────────────────────────────
  const handleUndo = useCallback(
    (snackKey: string | number) => {
      closeSnackbar(snackKey);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      snackKeyRef.current = null;

      const batch = [...pendingRef.current];
      pendingRef.current = [];

      if (batch.length > 0) {
        // Restaurar as linhas em todas as tabelas registradas que tiverem a row correspondente
        const rowsToRestore = batch.map((b) => b.row);
        restoreCallbacksRef.current.forEach((fn) => fn(rowsToRestore));
      }
    },
    [closeSnackbar],
  );

  // ── Solicitar delete com undo ──────────────────────────────────────────────
  const requestDelete = useCallback(
    (id: string, row: TxRow, accountId: string) => {
      pendingRef.current = [...pendingRef.current, { id, row, accountId }];

      // Reiniciar timer a cada novo delete (acumula deletes no mesmo lote)
      if (timerRef.current) clearTimeout(timerRef.current);

      // Fechar snackbar anterior para atualizar a contagem
      if (snackKeyRef.current !== null) closeSnackbar(snackKeyRef.current);

      const count = pendingRef.current.length;
      const message =
        count === 1 ? `${m.transactions.deleted}.` : `${count} ${m.transactions.deletedMultiple}.`;

      const key = enqueueSnackbar(message, {
        variant: "info",
        persist: true,
        action: (snackKey) => (
          <Button size="small" color="inherit" onClick={() => handleUndo(snackKey)}>
            {m.transactions.undoDelete}
          </Button>
        ),
      });
      snackKeyRef.current = key;

      timerRef.current = setTimeout(() => {
        if (snackKeyRef.current !== null) closeSnackbar(snackKeyRef.current);
        snackKeyRef.current = null;
        void executePendingDeletes();
      }, UNDO_TIMEOUT_MS);
    },
    [enqueueSnackbar, closeSnackbar, handleUndo, executePendingDeletes],
  );

  // ── Registro de callbacks de restauração ──────────────────────────────────
  const registerRestoreCallback = useCallback((tableId: string, fn: RestoreCallback) => {
    restoreCallbacksRef.current.set(tableId, fn);
  }, []);

  const unregisterRestoreCallback = useCallback((tableId: string) => {
    restoreCallbacksRef.current.delete(tableId);
  }, []);

  return (
    <DeleteUndoContext.Provider
      value={{ requestDelete, registerRestoreCallback, unregisterRestoreCallback }}
    >
      {children}
    </DeleteUndoContext.Provider>
  );
}

// ─── Hook de consumo ──────────────────────────────────────────────────────────

export function useDeleteUndo(): DeleteUndoContextValue {
  const ctx = useContext(DeleteUndoContext);
  if (!ctx) {
    throw new Error("useDeleteUndo deve ser usado dentro de <DeleteUndoProvider>");
  }
  return ctx;
}
