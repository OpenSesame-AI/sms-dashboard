import twilio from 'twilio'

// Initialize Twilio client
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in environment variables')
  }

  return twilio(accountSid, authToken)
}

/**
 * Search for available phone numbers in a given country
 * @param country - ISO country code (e.g., 'US', 'CA', 'GB')
 * @param options - Additional search options
 * @returns Array of available phone numbers
 */
export async function searchAvailableNumbers(
  country: string = 'US',
  options: {
    areaCode?: string
    smsEnabled?: boolean
    voiceEnabled?: boolean
    limit?: number
  } = {}
) {
  const client = getTwilioClient()
  const {
    areaCode,
    smsEnabled = true,
    voiceEnabled = true,
    limit = 20,
  } = options

  try {
    const searchParams: any = {
      smsEnabled,
      voiceEnabled,
      limit,
    }

    if (areaCode) {
      searchParams.areaCode = areaCode
    }

    const availableNumbers = await client.availablePhoneNumbers(country)
      .local
      .list(searchParams)

    return availableNumbers
  } catch (error) {
    console.error('Error searching for available numbers:', error)
    throw new Error(
      `Failed to search for available numbers: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Purchase a specific phone number from Twilio
 * @param phoneNumber - Phone number in E.164 format (e.g., '+14155552671')
 * @returns Purchased phone number details
 */
export async function purchasePhoneNumber(phoneNumber: string) {
  const client = getTwilioClient()

  try {
    const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
      phoneNumber,
    })

    return incomingPhoneNumber
  } catch (error) {
    console.error('Error purchasing phone number:', error)
    throw new Error(
      `Failed to purchase phone number: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Search for and purchase the first available phone number
 * @param country - ISO country code (e.g., 'US', 'CA', 'GB')
 * @param options - Additional search options
 * @returns Purchased phone number details
 */
export async function searchAndPurchaseNumber(
  country: string = 'US',
  options: {
    areaCode?: string
    smsEnabled?: boolean
    voiceEnabled?: boolean
  } = {}
) {
  // Search for available numbers
  const availableNumbers = await searchAvailableNumbers(country, {
    ...options,
    limit: 1,
  })

  if (availableNumbers.length === 0) {
    throw new Error(`No available phone numbers found in ${country}`)
  }

  // Purchase the first available number
  const phoneNumber = availableNumbers[0].phoneNumber
  if (!phoneNumber) {
    throw new Error('Phone number not found in search results')
  }

  const purchasedNumber = await purchasePhoneNumber(phoneNumber)

  return purchasedNumber
}


