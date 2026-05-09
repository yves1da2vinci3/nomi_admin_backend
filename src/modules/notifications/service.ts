import { prisma } from "../../lib/prisma.js";

function parseDays(input: unknown, fallback = 30): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 365);
}

/** Agrégats depuis table Notification — pas de tracking livraison / échecs réels ; réponse typée estimate. */
export async function getNotificationMetrics(queryDays: unknown) {
  const days = parseDays(queryDays, 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [total, read] = await Promise.all([
    prisma.notification.count({ where: { createdAt: { gte: since } } }),
    prisma.notification.count({ where: { createdAt: { gte: since }, isRead: true } }),
  ]);

  const sent = total;
  const delivered = total;
  const opened = read;
  const failed = 0;

  return {
    estimate: true as const,
    methodologyNote:
      "sent and delivered both count notification rows in the window (in-app only); opened uses isRead; push/email channels are not split — failed deliveries are not tracked (failed stays 0).",
    sent,
    delivered,
    opened,
    failed,
    deliveryRate: sent > 0 ? delivered / sent : 0,
    openRate: delivered > 0 ? opened / delivered : 0,
    byChannel: [
      {
        channel: "in_app" as const,
        sent,
        delivered,
        opened,
      },
    ],
  };
}
