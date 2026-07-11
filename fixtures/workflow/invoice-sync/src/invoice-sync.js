export async function syncPendingInvoices({ store, accountingClient, logger }) {
  const pending = await store.findPendingInvoices();

  for (const invoice of pending) {
    // Intentionally defective fixture state: the review/implementation workflow
    // must move this update after the external send succeeds.
    await store.markSynced(invoice.id);
    try {
      await accountingClient.sendInvoice(invoice);
      logger.info({ invoiceId: invoice.id }, 'invoice synced');
    } catch (error) {
      logger.warn({ invoiceId: invoice.id, error }, 'invoice sync failed');
    }
  }
}
