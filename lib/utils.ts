import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(
  phoneNumber: string,
  format: 'national' | 'international' = 'national'
): string {
  try {
    const parsed = parsePhoneNumber(phoneNumber)
    if (!parsed) return phoneNumber
    return format === 'national' ? parsed.formatNational() : parsed.formatInternational()
  } catch {
    return phoneNumber
  }
}

export function validatePhoneNumber(phoneNumber: string, defaultCountry?: string): boolean {
  return isValidPhoneNumber(phoneNumber, defaultCountry as any)
}

export function normalizePhoneNumber(phoneNumber: string, defaultCountry?: string): string | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry as any)
    return parsed?.format('E.164') ?? null
  } catch {
    return null
  }
}

export function getCountryCode(phoneNumber: string): string | null {
  try {
    const parsed = parsePhoneNumber(phoneNumber)
    return parsed?.country ?? null
  } catch {
    return null
  }
}

/**
 * Format a phone number with WhatsApp prefix for Twilio
 * @param phoneNumber - Phone number in E.164 format (e.g., '+1234567890')
 * @returns WhatsApp-formatted number (e.g., 'whatsapp:+1234567890')
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  // Remove whatsapp: prefix if already present
  const cleaned = phoneNumber.startsWith('whatsapp:') 
    ? phoneNumber.replace('whatsapp:', '') 
    : phoneNumber
  
  // Ensure it starts with +
  const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  
  return `whatsapp:${normalized}`
}

/**
 * Check if a phone number has the WhatsApp prefix
 * @param phoneNumber - Phone number to check
 * @returns true if the number starts with 'whatsapp:'
 */
export function isWhatsAppNumber(phoneNumber: string): boolean {
  return phoneNumber.startsWith('whatsapp:')
}

/**
 * Get WhatsApp Sandbox number from environment or return default
 * @returns WhatsApp Sandbox number (default: 'whatsapp:+14155238886')
 */
export function getWhatsAppSandboxNumber(): string {
  const sandboxNumber = process.env.TWILIO_WHATSAPP_SANDBOX_NUMBER
  return sandboxNumber || 'whatsapp:+14155238886'
}

/**
 * Remove WhatsApp prefix from a phone number if present
 * @param phoneNumber - Phone number that may have whatsapp: prefix
 * @returns Phone number without whatsapp: prefix
 */
export function removeWhatsAppPrefix(phoneNumber: string): string {
  return phoneNumber.startsWith('whatsapp:') 
    ? phoneNumber.replace('whatsapp:', '') 
    : phoneNumber
}

/**
 * Detect if the current environment is a WebView (in-app browser)
 * Checks for common WebView user agent patterns from social media apps
 * @param userAgent - Optional user agent string (defaults to navigator.userAgent)
 * @returns true if running in a WebView
 */
export function isWebView(userAgent?: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const ua = userAgent || window.navigator.userAgent

  // LinkedIn in-app browser
  if (ua.includes('LinkedInApp')) {
    return true
  }

  // Facebook in-app browser
  if (ua.includes('FBAN') || ua.includes('FBAV')) {
    return true
  }

  // Instagram in-app browser
  if (ua.includes('Instagram')) {
    return true
  }

  // Twitter/X in-app browser
  if (ua.includes('Twitter')) {
    return true
  }

  // Generic Android WebView (wv indicates WebView)
  if (ua.includes('wv') && !ua.includes('Chrome')) {
    return true
  }

  // iOS WebView detection (no Safari in user agent but has Mobile)
  // iOS Safari includes "Safari" but WebView doesn't
  if (
    /iPhone|iPad|iPod/.test(ua) &&
    ua.includes('Mobile') &&
    !ua.includes('Safari')
  ) {
    return true
  }

  // Additional check: if it's mobile but doesn't have standard browser indicators
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const hasStandardBrowser = ua.includes('Chrome') || ua.includes('Safari') || ua.includes('Firefox')
  
  if (isMobile && !hasStandardBrowser) {
    return true
  }

  return false
}
