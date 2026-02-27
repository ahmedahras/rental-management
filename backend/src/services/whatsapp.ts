import { env } from '../config/env';
import { InvoiceContext } from '../types';

function digitsOnly(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

export function normalizeWaPhone(phone: string, defaultCountryCode = env.DEFAULT_COUNTRY_CODE): string {
  const value = digitsOnly(phone);
  if (!value) {
    throw new Error('Invalid WhatsApp number');
  }

  if (value.length <= 10) {
    return `${defaultCountryCode}${value}`;
  }

  return value;
}

export function buildClickToChatUrl(phone: string, message: string): string {
  const normalized = normalizeWaPhone(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function buildTenantMessage(input: InvoiceContext): string {
  return [
    'Rent received \u2705',
    `Invoice: ${input.invoiceNumber}`,
    `Shop: ${input.shopNumber}`,
    `Month: ${input.rentMonth}`,
    `Amount Paid: \u20B9${input.amountPaid.toFixed(2)}`,
    `Remaining Due: \u20B9${input.remainingDue.toFixed(2)}`,
    'Download Bill:',
    input.pdfDownloadUrl,
  ].join('\n');
}

export function buildOwnerMessage(input: InvoiceContext): string {
  return [
    'Rent collected \uD83D\uDCB0',
    `Shop: ${input.shopNumber}`,
    `Tenant: ${input.tenantName}`,
    `Month: ${input.rentMonth}`,
    `Amount: \u20B9${input.amountPaid.toFixed(2)}`,
    'Bill:',
    input.pdfDownloadUrl,
  ].join('\n');
}

export function buildInvoiceWhatsAppLinks(params: {
  tenantPhone: string;
  ownerPhone: string;
  context: InvoiceContext;
}): { tenantWaLink: string; ownerWaLink: string; tenantMessage: string; ownerMessage: string } {
  const tenantMessage = buildTenantMessage(params.context);
  const ownerMessage = buildOwnerMessage(params.context);

  return {
    tenantMessage,
    ownerMessage,
    tenantWaLink: buildClickToChatUrl(params.tenantPhone, tenantMessage),
    ownerWaLink: buildClickToChatUrl(params.ownerPhone, ownerMessage),
  };
}

export function buildPaymentUpdateWhatsAppLinks(params: {
  tenantPhone: string;
  ownerPhone: string;
  context: {
    tenantName: string;
    ownerName: string;
    shopNumber: string;
    rentMonth: string;
    amountPaid: number;
    remainingDue: number;
    status: 'PAID' | 'PARTIAL' | 'PENDING';
  };
}): { tenantWaLink: string; ownerWaLink: string; tenantMessage: string; ownerMessage: string } {
  const { context } = params;

  const tenantMessage = [
    context.status === 'PAID' ? 'Rent received ✅' : 'Partial rent received ✅',
    `Shop: ${context.shopNumber}`,
    `Month: ${context.rentMonth}`,
    `Amount Paid: ₹${context.amountPaid.toFixed(2)}`,
    `Remaining Due: ₹${context.remainingDue.toFixed(2)}`,
  ].join('\n');

  const ownerMessage = [
    context.status === 'PAID' ? 'Rent collected 💰' : 'Partial rent collected 💰',
    `Shop: ${context.shopNumber}`,
    `Tenant: ${context.tenantName}`,
    `Month: ${context.rentMonth}`,
    `Amount Received: ₹${context.amountPaid.toFixed(2)}`,
    `Remaining Due: ₹${context.remainingDue.toFixed(2)}`,
  ].join('\n');

  return {
    tenantMessage,
    ownerMessage,
    tenantWaLink: buildClickToChatUrl(params.tenantPhone, tenantMessage),
    ownerWaLink: buildClickToChatUrl(params.ownerPhone, ownerMessage),
  };
}
