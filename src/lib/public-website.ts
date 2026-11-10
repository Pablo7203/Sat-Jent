export function whatsappHref(number: string | null, message: string) {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : null;
}
