import "server-only";
import { getResendEnv } from "@/lib/env/server";

type PaymentMethod = "PAY_ON_DELIVERY" | "PAYSTACK";
type FulfillmentMethod = "PICKUP" | "DELIVERY";
type PaymentStatus = "PENDING" | "PAID";
type FulfillmentStatus =
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type EmailDetails = {
  orderId: string;
  to: string;
  customerName: string;
  orderNumber: string;
  total: number | string | null;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string;
};

export type CustomerOrderEmailInput =
  | (EmailDetails & { kind: "order-placed"; trackingUrl: string })
  | (EmailDetails & {
      kind: "payment-required";
      paymentUrl: string;
      trackingUrl: string;
    })
  | (EmailDetails & { kind: "payment-confirmed" })
  | (EmailDetails & {
      kind: "fulfillment-update";
      status: FulfillmentStatus;
    });

const fulfillmentMessages: Record<
  FulfillmentStatus,
  { subject: string; heading: string; message: string }
> = {
  PREPARING: {
    subject: "is being prepared",
    heading: "Your order is being prepared",
    message:
      "Our team is preparing your items now. We’ll keep you updated as the order moves forward.",
  },
  READY_FOR_PICKUP: {
    subject: "is ready for collection",
    heading: "Your order is ready for collection",
    message:
      "Your items are ready at the SAT-J branch you selected. Please have your order number available when you arrive.",
  },
  OUT_FOR_DELIVERY: {
    subject: "is on its way",
    heading: "Your order is on its way",
    message:
      "The delivery team is bringing your order to you. Please keep your phone nearby in case they need to reach you.",
  },
  DELIVERED: {
    subject: "has been delivered",
    heading: "Your order has been delivered",
    message:
      "Our team has marked your order as delivered. We hope everything arrived safely and is just what you needed.",
  },
  CANCELLED: {
    subject: "has been cancelled",
    heading: "Your order has been cancelled",
    message:
      "This order has been cancelled. If you think this was a mistake, please contact the SAT-J team and include your order number.",
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function formatAmount(value: number | string | null): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "To be confirmed";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(amount);
}

function paymentDescription(
  method: PaymentMethod,
  status: PaymentStatus | undefined,
): string {
  if (method === "PAY_ON_DELIVERY") {
    return status === "PAID" ? "Paid to the delivery team" : "Due on delivery";
  }
  return status === "PAID" ? "Paid online with Paystack" : "Paystack";
}

function actionButton(url: string, label: string): string {
  return (
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:8px;background:#26392d;">' +
    '<a href="' +
    escapeHtml(url) +
    '" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">' +
    escapeHtml(label) +
    "</a></td></tr></table>"
  );
}

function emailCopy(input: CustomerOrderEmailInput): {
  subject: string;
  heading: string;
  message: string;
  preheader: string;
} {
  if (input.kind === "order-placed") {
    return {
      subject: "We’ve received order " + input.orderNumber,
      heading: "Your order is confirmed",
      message:
        "Thank you for shopping with SAT-J. We’ve received your order and our team will take care of the next steps.",
      preheader: "Order " + input.orderNumber + " is confirmed.",
    };
  }
  if (input.kind === "payment-required") {
    return {
      subject: "Complete payment for order " + input.orderNumber,
      heading: "One more step to complete your order",
      message:
        "Your order is ready for secure checkout. Use the button below to continue with Paystack. We’ll email you again once payment is confirmed.",
      preheader: "Complete secure payment for order " + input.orderNumber + ".",
    };
  }
  if (input.kind === "payment-confirmed") {
    return {
      subject: "Payment confirmed for order " + input.orderNumber,
      heading: "Your payment is confirmed",
      message:
        "We’ve confirmed your payment through Paystack. The SAT-J team will keep you informed as your order is prepared.",
      preheader: "Payment for order " + input.orderNumber + " is confirmed.",
    };
  }

  const status = fulfillmentMessages[input.status];
  return {
    subject: "Order " + input.orderNumber + " " + status.subject,
    heading: status.heading,
    message: status.message,
    preheader: "There’s an update for order " + input.orderNumber + ".",
  };
}

function buildEmail(input: CustomerOrderEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = emailCopy(input);
  const firstName = input.customerName.trim().split(/\s+/)[0] || "there";
  const total = formatAmount(input.total);
  const payment = paymentDescription(input.paymentMethod, input.paymentStatus);
  const fulfillment =
    input.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Branch collection";
  const deliveryAddress =
    input.fulfillmentMethod === "DELIVERY" && input.deliveryAddress
      ? '<tr><td colspan="2" style="padding:14px 0 0;color:#63675f;font-size:13px;line-height:20px;"><strong style="color:#20241f;">Delivery address</strong><br />' +
        escapeHtml(input.deliveryAddress) +
        "</td></tr>"
      : "";
  const trackingButton =
    input.kind === "order-placed" || input.kind === "payment-required"
      ? actionButton(input.trackingUrl, "Track your order")
      : "";
  const paymentButton =
    input.kind === "payment-required"
      ? actionButton(input.paymentUrl, "Continue to secure payment")
      : "";
  const trackingNote =
    input.kind === "payment-confirmed" || input.kind === "fulfillment-update"
      ? "For the latest order timeline, use the private tracking link in your original order confirmation email."
      : "";
  const rows = [
    '<tr><td style="padding:11px 0;color:#63675f;font-size:13px;">Order number</td><td style="padding:11px 0;text-align:right;color:#20241f;font-size:13px;font-weight:700;">' +
      escapeHtml(input.orderNumber) +
      "</td></tr>",
    '<tr><td style="padding:11px 0;border-top:1px solid #e7e5df;color:#63675f;font-size:13px;">Order total</td><td style="padding:11px 0;border-top:1px solid #e7e5df;text-align:right;color:#20241f;font-size:13px;font-weight:700;">' +
      escapeHtml(total) +
      "</td></tr>",
    '<tr><td style="padding:11px 0;border-top:1px solid #e7e5df;color:#63675f;font-size:13px;">Payment</td><td style="padding:11px 0;border-top:1px solid #e7e5df;text-align:right;color:#20241f;font-size:13px;">' +
      escapeHtml(payment) +
      "</td></tr>",
    '<tr><td style="padding:11px 0;border-top:1px solid #e7e5df;color:#63675f;font-size:13px;">Fulfilment</td><td style="padding:11px 0;border-top:1px solid #e7e5df;text-align:right;color:#20241f;font-size:13px;">' +
      escapeHtml(fulfillment) +
      "</td></tr>",
    deliveryAddress,
  ].join("");
  const greeting = "Hello " + firstName + ",";
  const plainText = [
    greeting,
    "",
    copy.message,
    "",
    "Order number: " + input.orderNumber,
    "Order total: " + total,
    "Payment: " + payment,
    "Fulfilment: " + fulfillment,
    input.deliveryAddress ? "Delivery address: " + input.deliveryAddress : "",
    input.kind === "payment-required"
      ? "Continue to secure payment: " + input.paymentUrl
      : "",
    input.kind === "order-placed" || input.kind === "payment-required"
      ? "Track your order: " + input.trackingUrl
      : "",
    trackingNote,
    "",
    "Thank you for choosing SAT-J.",
    "This message was sent because an order was placed on the SAT-J online store.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = [
    '<!doctype html><html lang="en"><body style="margin:0;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#20241f;">',
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' +
      escapeHtml(copy.preheader) +
      "</div>",
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f4ef;padding:32px 12px;"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e7e5df;border-radius:14px;overflow:hidden;">',
    '<tr><td style="padding:26px 32px;background:#26392d;color:#ffffff;"><div style="font-size:19px;font-weight:700;letter-spacing:.08em;">SAT-J ENT</div><div style="margin-top:5px;color:#d8dfd7;font-size:12px;">Online store order updates</div></td></tr>',
    '<tr><td style="padding:32px 32px 12px;"><p style="margin:0 0 10px;color:#aa4924;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Order update</p><h1 style="margin:0;color:#20241f;font-size:25px;line-height:1.25;">' +
      escapeHtml(copy.heading) +
      '</h1><p style="margin:18px 0 0;color:#50544d;font-size:15px;line-height:24px;">' +
      escapeHtml(greeting) +
      "<br />" +
      escapeHtml(copy.message) +
      "</p></td></tr>",
    '<tr><td style="padding:18px 32px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e7e5df;border-radius:10px;padding:4px 16px;">' +
      rows +
      "</table></td></tr>",
    paymentButton
      ? '<tr><td style="padding:10px 32px 0;">' + paymentButton + "</td></tr>"
      : "",
    trackingButton
      ? '<tr><td style="padding:12px 32px 0;">' + trackingButton + "</td></tr>"
      : "",
    trackingNote
      ? '<tr><td style="padding:0 32px;"><p style="margin:22px 0 0;color:#63675f;font-size:13px;line-height:21px;">' +
        escapeHtml(trackingNote) +
        "</p></td></tr>"
      : "",
    '<tr><td style="padding:28px 32px 30px;color:#63675f;font-size:12px;line-height:20px;">Thank you for choosing SAT-J. If you need help, please contact our team through the SAT-J website.<br /><br />SAT-J Ent<br />This is an order-related service email.</td></tr>',
    "</table></td></tr></table></body></html>",
  ].join("");

  return { subject: copy.subject, html, text: plainText };
}

function idempotencyKey(input: CustomerOrderEmailInput): string {
  if (input.kind === "order-placed") {
    return "checkout-order-placed/" + input.orderId;
  }
  if (input.kind === "payment-required") {
    return "checkout-payment-required/" + input.orderId;
  }
  if (input.kind === "payment-confirmed") {
    return "checkout-payment-confirmed/" + input.orderId;
  }
  return "checkout-fulfillment/" + input.orderId + "/" + input.status;
}

export async function sendCustomerOrderEmail(
  input: CustomerOrderEmailInput,
): Promise<{ sent: boolean }> {
  if (!input.to.trim()) return { sent: false };

  let env: ReturnType<typeof getResendEnv>;
  try {
    env = getResendEnv();
  } catch {
    console.error("Customer order email configuration is invalid", {
      event: input.kind,
    });
    return { sent: false };
  }

  if (!env) {
    console.warn(
      "Customer order email was skipped because Resend is not configured.",
    );
    return { sent: false };
  }

  const email = buildEmail(input);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey(input),
      },
      body: JSON.stringify({
        from: env.from,
        to: [input.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Customer order email could not be sent", {
        event: input.kind,
        responseStatus: response.status,
      });
      return { sent: false };
    }
    return { sent: true };
  } catch {
    console.error("Customer order email request failed", {
      event: input.kind,
    });
    return { sent: false };
  }
}
