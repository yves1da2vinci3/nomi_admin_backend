import { Expo } from "expo-server-sdk";
import { prisma } from "../../lib/prisma.js";

export async function listNotifications(params: {
  skip: number;
  take: number;
  userId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params.userId) where.userId = params.userId;

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export type PushSendResult =
  | { attempted: false }
  | { attempted: true; ok: boolean; detail: string };

/** Sends a real Expo push to the user's stored token when EXPO_ACCESS_TOKEN + expoPushToken are available; no-op (DB insert only) otherwise. */
export async function sendExpoPushToUser(
  userId: string,
  title: string,
  message: string
): Promise<PushSendResult> {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (!accessToken) return { attempted: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { expoPushToken: true },
  });
  const token = user?.expoPushToken;
  if (!token || !Expo.isExpoPushToken(token)) return { attempted: false };

  const expo = new Expo({ accessToken });
  try {
    const tickets = await expo.sendPushNotificationsAsync([
      { to: token, sound: "default", title, body: message },
    ]);
    const ticket = tickets[0];
    if (ticket?.status === "error") {
      return { attempted: true, ok: false, detail: ticket.message ?? "unknown error" };
    }
    return { attempted: true, ok: true, detail: "sent" };
  } catch (e) {
    return { attempted: true, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

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
