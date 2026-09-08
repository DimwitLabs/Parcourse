---
id: single-sign-on
title: Single Sign-On
---

# Single Sign-On

Parcourse can let people sign in with an account they already have, through any provider that supports OpenID Connect. Zitadel, Keycloak, Auth0, Entra, Okta and Google all work, and they are all set up the same way.

This is optional. If you do not configure it, the login screen stays exactly as it is today.

## Both Ways to Sign In Work Together

Turning single sign-on on does not turn the password form off. The login screen shows the email and password fields as usual, and a button for your provider underneath.

This matters most when something goes wrong. If your provider is unreachable, or you have typed the issuer address incorrectly, you can still sign in as an admin with your password and fix the configuration.

Which method a person uses depends on how their account was made:

| The account was | They sign in with |
| --- | --- |
| Created by an admin after you set up single sign-on | Your provider only. It has no password. |
| Created before you set up single sign-on | Either. See [Existing Accounts](#existing-accounts) below. |
| Given a password by an admin at any point | Either. |

An account with no password cannot use the password form at all, so there is nothing to guess or leak.

## Setting It Up

First, register Parcourse with your provider. Create a **web application** that uses the **authorization code flow with PKCE**, and give it this redirect URL:

```
https://parcourse.example.com/api/auth/oidc/callback
```

Replace the address with wherever your API is reached. Your provider will compare this exactly, so a missing `/api` or a trailing slash will cause it to reject the sign-in.

Your provider will give you a client ID and a client secret. Put them in `.env` along with the issuer address and the redirect URL you just registered:

```bash
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=the-id-your-provider-gave-you
OIDC_CLIENT_SECRET=the-secret-that-came-with-it
OIDC_REDIRECT_URL=https://parcourse.example.com/api/auth/oidc/callback
```

The issuer is the base address of your provider. Parcourse fetches `/.well-known/openid-configuration` from it and reads the endpoints and signing keys from there, so you do not need to configure any of those yourself.

Restart, and a **Continue with SSO** button appears on the login screen. Set `OIDC_NAME` to change what it says, for example `OIDC_NAME=Acme ID`.

If you set some of these four and not others, the backend will not start and will tell you which ones are missing. This is deliberate: a half-configured provider would otherwise look fine until somebody pressed the button.

## Who Can Sign In

By default, the account has to exist in Parcourse already. Somebody signing in through your provider is matched to their existing account, and the two are linked from then on.

The match is made on the email address, and only if your provider confirms that it has verified that address. If your provider does not verify addresses, Parcourse will not use one to match an existing account, because anyone who could set that address at the provider would then be able to sign in as its owner.

### Adding People

Use **Add user** on the admin screen as usual. When single sign-on is configured, the form asks for a name and email address only, because the account will be reached through your provider.

If somebody later needs to sign in without the provider, they can set a password themselves under **Settings → Account**, which is worth knowing about for a day the provider is unreachable. As an admin you can also give them one with **Set new password** on the admin screen.

### Letting People Sign Themselves In

To let anyone with an account at your provider into Parcourse without an admin adding them first:

```bash
OIDC_AUTO_PROVISION=true
```

A sign-in from an address that no Parcourse account uses will then create a student account with no password. Its owner can add one later under **Settings → Account** if they want a second way in.

This is off by default. If your provider covers an entire company or school, turning it on means everybody there can create an account on your instance. A single-user instance will not create a second account regardless of this setting.

### Existing Accounts

An account created before you set up single sign-on still has whatever password the admin gave it.

If that password was never changed, it is discarded the first time its owner signs in through your provider. The account becomes provider-only from that point, which prevents an unused password an admin once chose from remaining a valid way in.

If the person had already changed their password themselves, they keep it, and can carry on using either method.

## What Happens After Linking

An account is linked to your provider using the issuer and the subject identifier, not the email address. If somebody changes their email address at your provider, they still sign in to the same Parcourse account, with their courses, notes and knowledge graph intact.

If you are locked out entirely, including the admin password, [Backups and Recovery](/self-hosting/backups) explains how to reset it from the host.
