"use client";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SplitscreenIcon from "@mui/icons-material/Splitscreen";
import StarIcon from "@mui/icons-material/Star";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SectionCountType } from "@prisma/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";

import { getInstallmentGroupPanelDataAction } from "@/actions/installments";
import { listLinksForTransactionAction } from "@/actions/transaction-links";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateBr, formatDateTimeInTz, parseLocalDate } from "@/lib/dates";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { displaySignInverts, formatCentsToBrl } from "@/lib/money";
import type { InstallmentGroupPanelData } from "@/server/services/installment-service";
import type { TransactionLinkItem } from "@/server/services/transaction-link-service";

import { PartyAvatar } from "./PartyAvatar";
import type {
  CategoryOption,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow as TxRow,
} from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  tx: TxRow;
  accountId: string;
  sectionCountType: SectionCountType;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  timezone: string;
  canEdit: boolean;
  onEdit: () => void;
};

type Tag = { id: string; name: string; color: string | null };

/** Rótulo de seção ".cap" (Spec 66 · primitivas): mono, uppercase, tertiary. */
const capSx = {
  fontWeight: 600,
  fontSize: "0.62rem",
  fontFamily: typography.fontFamily.mono,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "text.tertiary",
};

/** Data por extenso com ano — ex.: "07 de junho de 2026" (cabeçalho de destaque, Spec 66 §9). */
function formatDateExtenso(date: string | Date): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Pílula ".chip" do frame (Spec 66 · primitivas reutilizadas): h20, padding 0 8px,
 * radius 5, 500/0.68rem, gap 4px. Reusada pelos status do cabeçalho de destaque
 * (favorita, pendente, parcela) — nunca `<Chip>` do MUI.
 */
function HeaderChip({
  children,
  bgcolor,
  color,
  icon,
  onClick,
}: {
  children: ReactNode;
  bgcolor: string;
  color: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Box
      component={onClick ? "button" : "span"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        height: 20,
        padding: "0 8px",
        borderRadius: "5px",
        fontWeight: 500,
        fontSize: "0.68rem",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        border: "none",
        bgcolor,
        color,
        ...(onClick && {
          cursor: "pointer",
          transition: "filter 0.12s",
          "&:hover": { filter: "brightness(0.92)" },
        }),
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

/** Valor ausente — nunca some, sempre "—" em cinza (Spec 66 §9, defeito relatado #7). */
function EmptyValueText() {
  return (
    <Typography sx={{ fontSize: "0.82rem", color: "text.disabled" }}>
      {m.transactions.detail.emptyValue}
    </Typography>
  );
}

/**
 * Linha label (esquerda, largura fixa) + valor (direita). O divisor entre linhas
 * é aplicado pelo container pai (`&>*:not(:last-child)`), não aqui — assim a
 * última linha de cada aba nunca fica com borda sobrando (Spec 66 §9, defeito #8).
 */
function DetailField({
  label,
  children,
  labelWidth = 120,
  py = "7px",
}: {
  label: string;
  children: ReactNode;
  labelWidth?: number;
  py?: string;
}) {
  return (
    <Box sx={{ display: "flex", gap: "10px", alignItems: "flex-start", py }}>
      <Typography
        sx={{ width: labelWidth, flexShrink: 0, fontSize: "0.78rem", color: "text.tertiary" }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

/** Avatar + nome de uma party responsável (Spec 60). */
function PartyInline({ party }: { party: ResponsiblePartyOption }) {
  return (
    <Stack direction="row" spacing={layout.inline} alignItems="center">
      <PartyAvatar
        kind={party.kind}
        icon={party.icon}
        color={party.color}
        imageUrl={party.imageUrl}
        name={party.name}
        size={24}
      />
      <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>{party.name}</Typography>
    </Stack>
  );
}

/** Chip de tag somente leitura (edição de tags é descontinuada no modal — TX-01c). */
function ReadOnlyTagChip({ tag }: { tag: Tag }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 26,
        borderRadius: "13px",
        border: "1px solid",
        borderColor: tag.color ?? "divider",
        bgcolor: tag.color ? `${tag.color}22` : "background.subtle",
        color: "text.primary",
        fontSize: "0.75rem",
        px: "8px",
        whiteSpace: "nowrap",
      }}
    >
      {tag.name}
    </Box>
  );
}

/**
 * Linha "Criada por"/"Editada por" (aba Histórico, Spec 66 §9, defeito #11):
 * avatar `.av` 22px + bloco de 2 linhas (nome / data mono), avatar centralizado
 * verticalmente em relação ao bloco inteiro (não só à 1ª linha).
 */
function HistoryMemberRow({
  member,
  dateIso,
  timezone,
}: {
  member: MemberOption | null;
  dateIso: string;
  timezone: string;
}) {
  const name = member?.name ?? member?.email ?? m.transactions.detail.removedUser;
  const initial = member?.name?.charAt(0)?.toUpperCase() ?? "?";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <Avatar
        src={member?.image ?? undefined}
        sx={{
          width: 22,
          height: 22,
          fontSize: "0.62rem",
          fontWeight: 600,
          bgcolor: "accent.primarySubtle",
          color: "accent.primary",
        }}
      >
        {initial}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }} noWrap>
          {name}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.68rem",
            fontFamily: typography.fontFamily.mono,
            color: "text.tertiary",
          }}
        >
          {formatDateTimeInTz(dateIso, timezone)}
        </Typography>
      </Box>
    </Box>
  );
}

/** Indicador de carregamento inline para subseções assíncronas (TX-01d). */
function LoadingRow() {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
      <CircularProgress size={16} aria-label={m.transactions.detail.loading} />
      <Typography variant="caption" color="text.secondary">
        {m.transactions.detail.loading}
      </Typography>
    </Stack>
  );
}

/** Estado de erro com opção de recarregar (TX-01d) — nunca uma aba/subseção em branco. */
function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      size="compact"
      title={message}
      action={
        <Button size="small" variant="outlined" onClick={onRetry}>
          {m.transactions.detail.reload}
        </Button>
      }
    />
  );
}

export function TransactionDetailDialog({
  open,
  onClose,
  tx,
  accountId,
  sectionCountType,
  categories,
  institutions,
  members,
  parties,
  timezone,
  canEdit,
  onEdit,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(0);

  const [links, setLinks] = useState<TransactionLinkItem[] | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linksError, setLinksError] = useState(false);

  const [schedule, setSchedule] = useState<InstallmentGroupPanelData | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState(false);

  function loadLinks() {
    setLoadingLinks(true);
    setLinksError(false);
    startTransition(async () => {
      const res = await listLinksForTransactionAction(accountId, { transactionId: tx.id });
      setLoadingLinks(false);
      if (res.ok) setLinks(res.data);
      else setLinksError(true);
    });
  }

  function loadSchedule(installmentGroupId: string) {
    setLoadingSchedule(true);
    setScheduleError(false);
    startTransition(async () => {
      const res = await getInstallmentGroupPanelDataAction(accountId, { installmentGroupId });
      setLoadingSchedule(false);
      if (res.ok && res.data) {
        setSchedule(res.data);
      } else {
        setSchedule(null);
        setScheduleError(true);
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    setActiveTab(0);
    setLinks(null);
    setLinksError(false);
    setSchedule(null);
    setScheduleError(false);
    loadLinks();
    if (tx.installmentGroupId) loadSchedule(tx.installmentGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx.id, accountId]);

  const findMember = (id: string | null) => members.find((mem) => mem.id === id) ?? null;

  const amount = BigInt(tx.amountCents);
  // subtract inverte o sinal exibido (mesma convenção de TransactionRow/MoveTransactionsDialog)
  const displayCents = displaySignInverts(sectionCountType) ? -amount : amount;
  const amountColor =
    displayCents > 0n ? "success.main" : displayCents < 0n ? "danger.main" : "text.tertiary";

  const category = categories.find((c) => c.id === tx.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === tx.subcategoryId);
  const institutionName =
    institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText;
  const responsibleParty = tx.responsiblePartyId
    ? (parties.find((p) => p.id === tx.responsiblePartyId) ?? null)
    : null;

  const createdBy = findMember(tx.createdById);
  const updatedBy = tx.updatedById ? findMember(tx.updatedById) : null;

  const hasSummaryContent = Boolean(
    category || institutionName || responsibleParty || tx.originalCurrency || tx.notes,
  );
  const hasClassificationContent = Boolean(
    tx.expenseType || tx.paymentMethod || tx.investmentType || tx.tags.length > 0,
  );
  const hasScheduleSection = Boolean(tx.installmentGroupId);
  const hasLinksSection = loadingLinks || linksError || (links !== null && links.length > 0);
  const installmentsLinksTabEmpty = !hasScheduleSection && !hasLinksSection;
  const isInstallment = Boolean(
    tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount,
  );
  const showHeaderBadges = tx.isPending || tx.isFavorite || isInstallment;

  // Divisor entre linhas de uma aba: aplicado pelo container (não some na última linha).
  const rowDividerSx = {
    "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: "border.subtle" },
  } as const;

  function handleOpenLinked(target: TransactionLinkItem["linkedTransaction"]) {
    onClose();
    router.push(`/${accountId}/months/${target.monthId}?tab=${target.sectionId}`);
  }

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      // O valor em destaque é o topo visual real do modal (Spec 66 §9), então o
      // título nativo fica oculto VISUALMENTE — mas segue no DOM para o
      // `aria-labelledby` (leitores de tela). O X nativo do DialogShell continua
      // visível no canto superior direito, colapsado na própria faixa do título.
      title={m.transactions.detail.titleNeutral}
      titleVisuallyHidden
      maxWidth="sm"
      actions={
        <>
          <Button
            variant="text"
            onClick={onClose}
            sx={{
              height: 32,
              borderRadius: "8px",
              color: "text.secondary",
              px: "12px",
              fontWeight: 500,
              fontSize: "0.8rem",
            }}
          >
            {m.transactions.detail.close}
          </Button>
          {canEdit && (
            <Button
              variant="contained"
              onClick={onEdit}
              sx={{
                height: 32,
                borderRadius: "8px",
                bgcolor: "accent.primary",
                color: "background.canvas",
                px: "14px",
                fontWeight: 600,
                fontSize: "0.8rem",
                "&:hover": { bgcolor: "accent.primaryHover" },
              }}
            >
              {m.transactions.actions.edit}
            </Button>
          )}
        </>
      }
    >
      {/* Container full-bleed: cancela o padding horizontal do DialogContent (px:
          layout.card) para que header/tabs cheguem até a borda real do modal
          (Spec 66 §9, defeito #4). O corpo (abaixo) reaplica seu próprio inset. */}
      <Box sx={{ mx: -layout.card }}>
        {/* ─── Cabeçalho de destaque: valor (apex) + descrição + data à esquerda;
            chips de status à direita, alinhados ao topo do valor ─── */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
            padding: "18px 20px",
            borderBottom: "1px solid",
            borderColor: "border.subtle",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="p"
              sx={{
                m: 0,
                fontWeight: 600,
                fontSize: "1.5rem",
                lineHeight: 1.25,
                fontFamily: typography.fontFamily.mono,
                fontVariantNumeric: "tabular-nums",
                color: amountColor,
              }}
            >
              {formatCentsToBrl(displayCents, { sign: "always" })}
            </Typography>
            <Typography
              sx={{
                mt: "3px",
                fontWeight: 500,
                fontSize: "0.9rem",
                color: "text.primary",
                wordBreak: "break-word",
              }}
            >
              {tx.description || m.transactions.detail.emptyValue}
            </Typography>
            <Typography
              sx={{ mt: "2px", fontWeight: 400, fontSize: "0.76rem", color: "text.tertiary" }}
            >
              {formatDateExtenso(tx.occurredOn)}
            </Typography>
          </Box>

          {showHeaderBadges && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                alignItems: "flex-end",
                flexShrink: 0,
              }}
            >
              {tx.isPending && (
                <HeaderChip bgcolor="warning.subtle" color="warning.main">
                  {m.transactions.fields.isPending}
                </HeaderChip>
              )}
              {tx.isFavorite && (
                <HeaderChip
                  bgcolor="warning.subtle"
                  color="warning.main"
                  icon={<StarIcon sx={{ fontSize: 12 }} />}
                >
                  {m.transactions.fields.isFavorite}
                </HeaderChip>
              )}
              {isInstallment && (
                <Tooltip
                  title={m.transactions.installments.badgeTooltip(
                    tx.installmentNumber!,
                    tx.installmentGroupCount!,
                    tx.description ?? "",
                  )}
                >
                  <HeaderChip
                    bgcolor="accent.primarySubtle"
                    color="accent.primary"
                    icon={<SplitscreenIcon sx={{ fontSize: 12 }} />}
                    onClick={() => setActiveTab(2)}
                  >
                    {m.transactions.installments.badge(
                      tx.installmentNumber!,
                      tx.installmentGroupCount!,
                    )}
                  </HeaderChip>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        <Tabs
          value={activeTab}
          onChange={(_, v: number) => setActiveTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={m.transactions.detail.titleNeutral}
          sx={{
            minHeight: "auto",
            px: "14px",
            borderBottom: "1px solid",
            borderColor: "border.subtle",
            "& .MuiTab-root": {
              minHeight: "auto",
              padding: "10px 11px",
              fontSize: "0.78rem",
              fontWeight: 500,
              color: "text.tertiary",
            },
            "& .MuiTab-root.Mui-selected": {
              fontWeight: 600,
              color: "text.primary",
            },
            "& .MuiTabs-indicator": { backgroundColor: "accent.primary" },
          }}
        >
          <Tab label={m.transactions.detail.tabs.summary} />
          <Tab label={m.transactions.detail.tabs.classification} />
          <Tab label={m.transactions.detail.tabs.installmentsLinks} />
          <Tab label={m.transactions.detail.tabs.history} />
        </Tabs>

        <Box sx={{ padding: "12px 20px" }}>
          {/* ─── Aba: Resumo ─── */}
          {activeTab === 0 &&
            (hasSummaryContent ? (
              <Box sx={rowDividerSx}>
                <DetailField label={m.transactions.fields.category}>
                  {category ? (
                    <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>
                      {category.name}
                      {subcategory ? ` › ${subcategory.name}` : ""}
                    </Typography>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>

                <DetailField label={m.transactions.fields.institution}>
                  {institutionName ? (
                    <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>
                      {institutionName}
                    </Typography>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>

                <DetailField label={m.transactions.fields.responsibleUser}>
                  {responsibleParty ? <PartyInline party={responsibleParty} /> : <EmptyValueText />}
                </DetailField>

                <DetailField label={m.transactions.foreignCurrency.label}>
                  {tx.originalCurrency ? (
                    <Typography
                      sx={{
                        fontFamily: typography.fontFamily.mono,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.82rem",
                        color: "text.primary",
                      }}
                    >
                      {tx.originalAmountCents && tx.originalAmountCents !== "0"
                        ? `${tx.originalCurrency} ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
                        : tx.originalCurrency}
                      {tx.exchangeRate ? (
                        <Typography component="span" variant="caption" color="text.tertiary">
                          {` · câmbio R$${tx.exchangeRate.toFixed(4)}`}
                        </Typography>
                      ) : null}
                    </Typography>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>

                <DetailField label={m.transactions.fields.notes}>
                  {tx.notes ? (
                    <Box
                      sx={{
                        p: layout.stack,
                        bgcolor: "background.subtle",
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: "border.subtle",
                      }}
                    >
                      <Typography
                        sx={{ whiteSpace: "pre-wrap", color: "text.primary", fontSize: "0.82rem" }}
                      >
                        {tx.notes}
                      </Typography>
                    </Box>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>
              </Box>
            ) : (
              <EmptyState size="compact" title={m.transactions.detail.emptySummary} />
            ))}

          {/* ─── Aba: Classificação ─── */}
          {activeTab === 1 &&
            (hasClassificationContent ? (
              <Box sx={rowDividerSx}>
                <DetailField label={m.transactions.fields.expenseType}>
                  {tx.expenseType ? (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      {tx.expenseType === "fixed" && (
                        <LockOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      )}
                      {tx.expenseType === "variable" && (
                        <WavesOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      )}
                      {tx.expenseType === "one_time" && (
                        <FlashOnOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      )}
                      <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>
                        {m.transactions.expenseTypes[tx.expenseType]}
                      </Typography>
                    </Stack>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>

                <DetailField label={m.transactions.detail.paymentMethodShort}>
                  {tx.paymentMethod ? (
                    <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>
                      {m.transactions.paymentMethods[tx.paymentMethod]}
                    </Typography>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>

                <DetailField label={m.transactions.fields.investmentType}>
                  {tx.investmentType ? (
                    <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>
                      {(m.transactions.investmentTypes as Record<string, string>)[
                        tx.investmentType
                      ] ?? tx.investmentType}
                    </Typography>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>

                <DetailField label={m.transactions.fields.tags}>
                  {tx.tags.length > 0 ? (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap">
                      {tx.tags.map((tag) => (
                        <ReadOnlyTagChip key={tag.id} tag={tag} />
                      ))}
                    </Stack>
                  ) : (
                    <EmptyValueText />
                  )}
                </DetailField>
              </Box>
            ) : (
              <EmptyState size="compact" title={m.transactions.detail.emptyClassification} />
            ))}

          {/* ─── Aba: Parcelas ─── */}
          {activeTab === 2 && (
            <>
              {hasScheduleSection && (
                <Box sx={{ mb: hasLinksSection ? "14px" : 0 }}>
                  {loadingSchedule && <LoadingRow />}
                  {!loadingSchedule && scheduleError && (
                    <ErrorRow
                      message={m.transactions.installments.loadError}
                      onRetry={() => tx.installmentGroupId && loadSchedule(tx.installmentGroupId)}
                    />
                  )}
                  {!loadingSchedule && !scheduleError && schedule && tx.installmentNumber && (
                    <>
                      <Typography sx={capSx}>
                        {m.transactions.installments.installmentPosition(
                          tx.installmentNumber,
                          schedule.installmentCount,
                        )}
                        {" · total "}
                        {formatCentsToBrl(BigInt(schedule.totalCents))}
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: "5px", mt: "8px" }}>
                        {schedule.items.map((item) => {
                          const Icon =
                            item.status === "paid"
                              ? CheckCircleIcon
                              : item.status === "pending"
                                ? RadioButtonCheckedIcon
                                : ScheduleIcon;
                          const iconColor =
                            item.status === "paid"
                              ? "success.main"
                              : item.status === "pending"
                                ? "accent.primary"
                                : "text.tertiary";
                          const textColor =
                            item.status === "paid"
                              ? "text.secondary"
                              : item.status === "pending"
                                ? "text.primary"
                                : "text.tertiary";
                          const monthLabel = format(parseLocalDate(item.date), "MMMM", {
                            locale: ptBR,
                          });

                          return (
                            <Box
                              key={item.installmentNumber}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  minWidth: 0,
                                }}
                              >
                                <Icon sx={{ fontSize: 13, color: iconColor, flexShrink: 0 }} />
                                <Typography
                                  component="span"
                                  sx={{
                                    fontSize: "0.76rem",
                                    color: textColor,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {item.installmentNumber}/{schedule.installmentCount} ·{" "}
                                  {monthLabel}
                                </Typography>
                              </Box>
                              <Typography
                                component="span"
                                sx={{
                                  fontFamily: typography.fontFamily.mono,
                                  fontVariantNumeric: "tabular-nums",
                                  fontSize: "0.76rem",
                                  color: item.status === "waiting" ? "text.tertiary" : textColor,
                                  flexShrink: 0,
                                }}
                              >
                                {item.status === "waiting"
                                  ? m.transactions.installments.statusForecast
                                  : formatCentsToBrl(BigInt(item.amountCents))}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </>
                  )}
                </Box>
              )}

              {hasLinksSection && (
                <Box>
                  <Typography sx={{ ...capSx, mb: "6px" }}>
                    {m.transactions.detail.linksTitle}
                  </Typography>
                  {loadingLinks && <LoadingRow />}
                  {!loadingLinks && linksError && (
                    <ErrorRow message={m.transactions.detail.loadError} onRetry={loadLinks} />
                  )}
                  {!loadingLinks && !linksError && links && links.length > 0 && (
                    <Stack spacing={1}>
                      {links.map((link) => (
                        <Box
                          key={link.id}
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            padding: "8px 10px",
                            bgcolor: "background.canvas",
                            borderRadius: "8px",
                            border: "1px solid",
                            borderColor: "border.subtle",
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              sx={{ fontSize: "0.68rem", color: "text.tertiary", display: "block" }}
                            >
                              {m.transactions.links.types[link.type]}
                            </Typography>
                            <Typography
                              noWrap
                              sx={{ fontSize: "0.82rem", color: "text.primary", fontWeight: 500 }}
                            >
                              {link.linkedTransaction.description ??
                                m.transactions.detail.emptyValue}
                            </Typography>
                            <Typography sx={{ fontSize: "0.76rem", color: "text.secondary" }}>
                              {formatDateBr(link.linkedTransaction.occurredOn)} ·{" "}
                              <Typography
                                component="span"
                                sx={{ fontSize: "0.76rem", fontFamily: typography.fontFamily.mono }}
                              >
                                {formatCentsToBrl(BigInt(link.linkedTransaction.amountCents))}
                              </Typography>
                            </Typography>
                          </Box>
                          <Tooltip title={m.transactions.detail.openLinked}>
                            <IconButton
                              size="small"
                              sx={{ p: 0.5, flexShrink: 0 }}
                              aria-label={m.transactions.detail.openLinked}
                              onClick={() => handleOpenLinked(link.linkedTransaction)}
                            >
                              <OpenInNewIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {installmentsLinksTabEmpty && (
                <EmptyState size="compact" title={m.transactions.detail.emptyInstallmentsLinks} />
              )}
            </>
          )}

          {/* ─── Aba: Histórico ─── */}
          {activeTab === 3 && (
            <Box sx={rowDividerSx}>
              <DetailField label={m.transactions.fields.source} labelWidth={100} py="9px">
                <Typography sx={{ fontSize: "0.82rem", color: "text.primary" }}>
                  {m.transactions.sources[tx.source] ?? tx.source}
                </Typography>
              </DetailField>

              <DetailField label={m.transactions.detail.createdBy} labelWidth={100} py="9px">
                <HistoryMemberRow member={createdBy} dateIso={tx.createdAt} timezone={timezone} />
              </DetailField>

              <DetailField label={m.transactions.detail.updatedBy} labelWidth={100} py="9px">
                {tx.updatedById ? (
                  <HistoryMemberRow member={updatedBy} dateIso={tx.updatedAt} timezone={timezone} />
                ) : (
                  <EmptyValueText />
                )}
              </DetailField>
            </Box>
          )}
        </Box>
      </Box>
    </DialogShell>
  );
}
