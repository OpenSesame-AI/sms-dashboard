# Clerk Dashboard Configuration for WebView OAuth Support

This document outlines the steps to enable alternative authentication methods in Clerk that work in WebViews (email/password, magic links).

## Problem

Google OAuth doesn't work in WebViews (LinkedIn, Facebook, Instagram in-app browsers) due to Google's security policy. Users accessing your app from social media links on mobile will see OAuth errors.

## Solution

Enable email/password and magic link authentication in Clerk. These methods work in WebViews and provide a seamless authentication experience.

## Steps to Configure Clerk

### 1. Enable Email/Password Authentication

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **User & Authentication** → **Email, Phone, Username**
3. Under **Email address**, ensure the following are enabled:
   - ✅ **Email address** (required)
   - ✅ **Email code** (for magic links)
   - ✅ **Email link** (for magic links)
   - ✅ **Password** (for email/password authentication)

### 2. Configure Authentication Methods

1. In Clerk Dashboard, go to **User & Authentication** → **Email, Phone, Username**
2. Under **Email address** settings:
   - Enable **"Email code"** - This enables magic link authentication
   - Enable **"Password"** - This enables email/password authentication
   - Set **"Email verification"** to your preference (recommended: "Required" for production)

### 3. Configure OAuth Providers (Optional)

1. Go to **User & Authentication** → **Social Connections**
2. Keep OAuth providers enabled (Google, etc.) - they'll work in system browsers
3. The UI will automatically prioritize email/password in WebViews

### 4. Test the Configuration

1. Open your app in a WebView (e.g., from LinkedIn on mobile)
2. You should see:
   - Email/password fields prominently displayed
   - Magic link option available
   - OAuth buttons still visible but with guidance message
   - No blocking or errors

## What This Achieves

- ✅ Users in WebViews can authenticate via email/password (works immediately)
- ✅ Users in WebViews can use magic links (works immediately)
- ✅ OAuth still available for users in system browsers
- ✅ No more "disallowed_useragent" errors
- ✅ Better UX - users aren't blocked, they have working alternatives

## Code Changes Already Implemented

The following code changes have been made to support this:

1. **Simplified WebView Warning** - Shows guidance instead of blocking
2. **SignIn Component Updates** - Prioritizes email/password in WebViews
3. **Server-Side Detection** - Middleware detects WebView and sets headers
4. **Removed Blocking Logic** - No more aggressive blocking that prevents authentication

## Next Steps After Configuration

1. Test authentication flow in WebView (LinkedIn app on mobile)
2. Verify email/password works correctly
3. Test magic link functionality
4. Confirm OAuth still works in system browsers

## Troubleshooting

If email/password doesn't appear:
- Verify Clerk Dashboard settings are saved
- Check that email/password is enabled in your Clerk instance
- Clear browser cache and test again
- Check Clerk Dashboard logs for any errors

If OAuth still shows errors in WebView:
- This is expected - OAuth doesn't work in WebViews
- Users should use email/password or open in system browser for OAuth
- The guidance message will inform users about this




