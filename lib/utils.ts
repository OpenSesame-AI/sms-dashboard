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
