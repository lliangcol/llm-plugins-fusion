import assert from 'node:assert/strict';
import test from 'node:test';
import { syncPendingInvoices } from '../src/invoice-sync.js';

function fakeStore(invoices) {
  const syncedIds = [];
  return {
    syncedIds,
    async findPendingInvoices() {
      return invoices.filter((invoice) => !syncedIds.includes(invoice.id));
    },
    async markSynced(invoiceId) {
      syncedIds.push(invoiceId);
    },
  };
}

function fakeAccountingClient({ fail = false } = {}) {
  const sentIds = [];
  return {
    sentIds,
    async sendInvoice(invoice) {
      if (fail) throw new Error('fictional external failure');
      sentIds.push(invoice.id);
    },
  };
}

function fakeLogger() {
  return {
    infoCalls: [],
    warnCalls: [],
    info(...args) {
      this.infoCalls.push(args);
    },
    warn(...args) {
      this.warnCalls.push(args);
    },
  };
}

test('marks invoice synced after successful send', async () => {
  const store = fakeStore([{ id: 'inv-1' }]);
  const accountingClient = fakeAccountingClient();
  const logger = fakeLogger();

  await syncPendingInvoices({ store, accountingClient, logger });

  assert.deepEqual(accountingClient.sentIds, ['inv-1']);
  assert.deepEqual(store.syncedIds, ['inv-1']);
});

test('logs external failures', async () => {
  const store = fakeStore([{ id: 'inv-1' }]);
  const accountingClient = fakeAccountingClient({ fail: true });
  const logger = fakeLogger();

  await syncPendingInvoices({ store, accountingClient, logger });

  assert.equal(logger.warnCalls.length, 1);
});
