---
id: single-sign-on
title: Single Sign-On
---

# Single Sign-On

Parcourse can hand sign-in to an OpenID Connect provider, so people use the account they already have. It speaks the specification rather than any particular provider, which means Zitadel, Keycloak, Auth0, Entra, Okta and Google all work the same way and none of them needs its own setting.

Leave it unconfigured and nothing changes: no button, no extra screen, and the email and password form you already have.

## Setting It Up

Register Parcourse with your provider as a **web application using the authorization code flow with PKCE**, and give it one redirect URL:

```
https://parcourse.example.com/api/auth/oidc/callback
```

Use whatever address your API is actually reached on. It has to match exactly, character for character, or the provider will refuse the sign-in.

Then four values in `.env`:

```bash
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=the-id-your-provider-gave-you
OIDC_CLIENT_SECRET=the-secret-that-came-with-it
OIDC_REDIRECT_URL=https://parcourse.example.com/api/auth/oidc/callback
```

Restart, and the login screen grows a **Continue with SSO** button. `OIDC_NAME` changes what it says.

The issuer is the base address, not the discovery document. Parcourse asks for `/.well-known/openid-configuration` itself and reads every endpoint from there. If any of the four is set and the others are not, the backend refuses to start and names what is missing, rather than leaving you with a button that fails when somebody presses it.

## Who Gets In

By default, **an account has to exist already**. Somebody signing in through the provider is matched to it and, from then on, that provider account is linked to that Parcourse account.

The match happens on the email address, and only when the provider says it has verified that address. A provider that does not verify addresses cannot be used to claim an existing account, because anyone able to type an address there could otherwise sign in as its owner.

To let new people in without an admin creating them first:

```bash
OIDC_AUTO_PROVISION=true
```

A sign-in from an address nobody uses then makes a student account with no password. It is off by default because on a provider covering a whole company or school, on means everyone there has an account on your instance. A single-user instance never creates a second account whatever this is set to.

## After Linking

The link is on the provider's issuer and subject, not the email address, so somebody changing their address at the provider keeps their courses, notes and knowledge graph.

Accounts made this way have no password, and cannot use the email and password form. Everyone else still can: **the password form never goes away**. If your provider is unreachable or misconfigured, an admin can still sign in and fix it, and if that password has been forgotten too, [Backups and Recovery](/self-hosting/backups) covers resetting it from the host.
