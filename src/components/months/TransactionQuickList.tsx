"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { updateTransactionAction } from "@/actions/transactions";
import { formatCentsToBrl } from "@/lib/money";
import { AppLink } from "@/components/ui/AppLink";

type Tx = {
  id: string;
  description: string | null;
  amountCents: string;
  sectionId: string;
};

type Mode = "pending" | "favorite" | "recent";

type Props = {
  accountId: string;
  monthId: string;
  transactions: Tx[];
  mode: Mode;
};

export function TransactionQuickList({ accountId, monthId, transactions, mode }: Props) {
  const [items, setItems] = useState<Tx[]>(transactions);
  const [isPending, startTransition] = useTransition();

  function handleUnmark(id: string) {
    startTransition(async () => {
      const patch = mode === "pending" ? { isPending: false } : { isFavorite: false };
      const result = await updateTransactionAction(accountId, { transactionId: id, ...patch });
      if (result.ok) {
        setItems((prev) => prev.filter((tx) => tx.id !== id));
      }
    });
  }

  if (items.length === 0) {
    const emptyText =
      mode === "pending"
        ? "Nenhuma transação pendente."
        : mode === "favorite"
          ? "Nenhuma transação favorita."
          : "Nenhuma transação registrada.";
    return (
      <Typography variant="caption" color="text.disabled" sx={{ px: 0.5 }}>
        {emptyText}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {items.map((tx) => {
        const amount = BigInt(tx.amountCents);
        return (
          <Box
            key={tx.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.75,
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {/* Unmark button — não exibido no modo "recent" */}
            {mode !== "recent" && (
              <Tooltip title={mode === "pending" ? "Marcar como realizada" : "Remover dos favoritos"}>
                <IconButton
                  size="small"
                  disabled={isPending}
                  onClick={() => handleUnmark(tx.id)}
                  sx={{ color: mode === "favorite" ? "warning.main" : "success.main" }}
                >
                  {mode === "favorite" ? (
                    <StarIcon fontSize="small" />
                  ) : (
                    <CheckCircleOutlineIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}

            {/* Description */}
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, fontSize: 13 }}
              title={tx.description ?? "Sem descrição"}
            >
              {tx.description ?? <em style={{ color: "#9e9e9e" }}>Sem descrição</em>}
            </Typography>

            {/* Amount */}
            <Typography
              variant="body2"
              fontWeight="medium"
              sx={{ fontSize: 13, whiteSpace: "nowrap" }}
              color={amount < 0n ? "error.main" : "success.main"}
            >
              {formatCentsToBrl(amount)}
            </Typography>

            {/* Navigate to section */}
            <Tooltip title="Ir para a seção">
              <IconButton
                size="small"
                component={AppLink}
                href={`/${accountId}/months/${monthId}?tab=${tx.sectionId}`}
                sx={{ color: "text.disabled" }}
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
