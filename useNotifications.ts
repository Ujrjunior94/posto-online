/**
 * Helper module for Browser Notifications API
 */

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn("Browser does not support notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return false;
  }
}

export function sendBrowserNotification(
  title: string,
  body: string,
  options?: Partial<NotificationOptions>
) {
  if (!isNotificationSupported()) {
    return;
  }

  const fire = () => {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "meuposto-alert-" + Date.now(),
        requireInteraction: true,
        ...options,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.error("Failed to display notification:", e);
    }
  };

  if (Notification.permission === "granted") {
    fire();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        fire();
      }
    });
  }
}

/**
 * Trigger notification when a Cashier Shortage (Falta de Caixa) is registered
 */
export function notifyCashierShortage(data: {
  tipo: string;
  valorTotal: number;
  data: string;
  shiftTurn: string;
  funcionariosEnvolvidos: string[];
}) {
  const isFalta = data.tipo === "Falta";
  const title = isFalta
    ? `🚨 ALERTA: Falta de Caixa Registrada!`
    : `💰 REGISTRO: Sobra de Caixa Registrada`;

  const body = `Valor: R$ ${data.valorTotal.toFixed(2)} (${data.tipo})\nData: ${data.data} - ${data.shiftTurn}\nEnvolvidos: ${
    data.funcionariosEnvolvidos.join(", ") || "Não especificado"
  }`;

  sendBrowserNotification(title, body, {
    tag: `shortage-${Date.now()}`,
  });
}

/**
 * Trigger notification when a Supply Request (Pedido de Material) is approved or rejected
 */
export function notifySupplyRequestStatus(data: {
  itemDescricao: string;
  tipo: string;
  paraQuemSolicita: string;
  status: "Aprovado" | "Cancelado" | "Entregue" | string;
}) {
  const isApproved = data.status === "Aprovado" || data.status === "Entregue";
  const isRejected = data.status === "Cancelado";

  let icon = "📦";
  if (isApproved) icon = "✅";
  if (isRejected) icon = "❌";

  const title = `${icon} Pedido de Material ${data.status.toUpperCase()}`;
  const body = `Item: ${data.itemDescricao} (${data.tipo})\nDestinatário: ${data.paraQuemSolicita}\nStatus Atual: ${data.status}`;

  sendBrowserNotification(title, body, {
    tag: `supply-${Date.now()}`,
  });
}
