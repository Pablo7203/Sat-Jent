import "server-only";
import { getResendEnv } from "@/lib/env/server";

export type AccessNotification = {
  to: string;
  employeeName: string;
  roleName: string;
  branchNames: string[];
  isActive: boolean;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );

export async function sendAccessUpdatedEmail(input: AccessNotification) {
  const env = getResendEnv();
  if (!env) return { sent: false, reason: "not-configured" } as const;
  const branches = input.branchNames.length
    ? input.branchNames.join(", ")
    : "All branches / company-wide access";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.from,
      to: [input.to],
      subject: "Your SAT-J Ent access has been updated",
      html: `<p>Hello ${escapeHtml(input.employeeName || "there")},</p><p>Your SAT-J Ent access has been updated by an administrator.</p><ul><li><strong>Role:</strong> ${escapeHtml(input.roleName)}</li><li><strong>Status:</strong> ${input.isActive ? "Active" : "Inactive"}</li><li><strong>Branches:</strong> ${escapeHtml(branches)}</li></ul><p>If you did not expect this change, contact your SAT-J Ent administrator.</p>`,
      text: `Hello ${input.employeeName || "there"},\n\nYour SAT-J Ent access has been updated.\nRole: ${input.roleName}\nStatus: ${input.isActive ? "Active" : "Inactive"}\nBranches: ${branches}\n\nIf you did not expect this change, contact your SAT-J Ent administrator.`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend access notification failed", response.status, detail);
    return { sent: false, reason: "provider-error" } as const;
  }
  return { sent: true } as const;
}
