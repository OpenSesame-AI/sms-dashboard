import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

// Get encryption key from environment variable
// If not set, generate a key (for development only - should be set in production)
const getEncryptionKey = async (): Promise<Buffer> => {
  const keyString = process.env.INTEGRATION_ENCRYPTION_KEY
  
  if (!keyString) {
    // For development, use a default key (NOT SECURE FOR PRODUCTION)
    console.warn('WARNING: INTEGRATION_ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION)')
    return Buffer.from('default-encryption-key-32-bytes-long!!', 'utf-8')
  }
  
  // Derive a 32-byte key from the environment variable
  return (await scryptAsync(keyString, 'salt', 32)) as Buffer
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts a string value using AES-256-GCM
 * @param text - The text to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all base64)
 */
export async function encrypt(text: string): Promise<string> {
  if (!text) return text
  
  const key = await getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  const authTag = cipher.getAuthTag()
  
  // Return format: iv:authTag:encryptedData (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypts an encrypted string
 * @param encryptedText - The encrypted text in format: iv:authTag:encryptedData
 * @returns Decrypted string
 */
export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return encryptedText
  
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }
    
    const [ivBase64, authTagBase64, encrypted] = parts
    const key = await getEncryptionKey()
    const iv = Buffer.from(ivBase64, 'base64')
    const authTag = Buffer.from(authTagBase64, 'base64')
    
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

