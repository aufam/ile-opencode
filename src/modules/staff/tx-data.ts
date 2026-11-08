import { createResource, onCleanup, type Accessor, type Resource } from "solid-js";
import { transactionsService } from "../../api/services/transactions.service";
import { realtime } from "../../api/ws";
import type { Transaction } from "../../lib/types";

export interface TxData {
  tx: Resource<Transaction>;
  refetch: () => void;
}

export function useTxResource(idAccess: Accessor<string | undefined>): TxData {
  const [tx, { refetch }] = createResource(idAccess, (id) => transactionsService.get(id));

  const unsub = realtime.subscribe({
    onEvent: (ev) => {
      if (ev.type === "price.updated" || ev.transactionId === undefined) {
        refetch();
      } else if (ev.transactionId === idAccess()) {
        refetch();
      }
    },
  });
  onCleanup(unsub);

  return { tx, refetch };
}

export function itemTotal(tx: Transaction | undefined): number {
  if (!tx) return 0;
  return tx.items.reduce((a, it) => a + (it.quote?.total ?? 0), 0);
}

export function itemsAppraised(tx: Transaction | undefined): boolean {
  return Boolean(tx && tx.items.length > 0 && tx.items.every((it) => it.appraisal && it.appraisal.weightG > 0));
}

export function itemsQuoted(tx: Transaction | undefined): boolean {
  return Boolean(tx && tx.items.length > 0 && tx.items.every((it) => it.quote));
}

export function hasSomeQuote(tx: Transaction | undefined): boolean {
  return Boolean(tx && tx.items.some((it) => it.quote));
}
