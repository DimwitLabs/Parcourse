---
id: single-sign-on
title: Single Sign-On
---

# Single Sign-On

Parcourse can let people sign in with an account they already have, through any provider that supports OpenID Connect. Zitadel, Keycloak, Auth0, Entra, Okta and Google all work, and they are all set up the same way.

This is optional. If you do not configure it, the login screen stays exactly as it is today.

## Both Ways to Sign In Work Together

By default, turning single sign-on on does not turn the password form off. If you would rather the provider were the only way in, see [Making It the Only Way In](#making-it-the-only-way-in) below; everything in this section describes the default. The login screen shows the email and password fields as usual, and a button for your provider underneath.

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
https://parcourse.example.com/auth/oidc/callback
```

Replace the address with wherever your **backend** is reached, which is not always the same host and port as the app itself. Your provider compares this exactly, so a wrong port or a trailing slash will cause it to reject the sign-in.

If you have not put a proxy in front of Parcourse, the backend is on its own port and the redirect URL looks like `http://localhost:8000/auth/oidc/callback`. If you serve everything from one host through a proxy, use whatever path reaches the backend there.

Your provider will give you a client ID and a client secret. Put them in `.env` along with the issuer address and the redirect URL you just registered:

```bash
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=the-id-your-provider-gave-you
OIDC_CLIENT_SECRET=the-secret-that-came-with-it
OIDC_REDIRECT_URL=https://parcourse.example.com/auth/oidc/callback
```

The issuer is the base address of your provider. Parcourse fetches `/.well-known/openid-configuration` from it and reads the endpoints and signing keys from there, so you do not need to configure any of those yourself.

Then bring the stack up with the single sign-on file layered over the one you normally use:

```bash
docker compose -f docker-compose.yml -f docker-compose.oidc.yml up -d
```

Naming both files on every command gets tiring, and forgetting one quietly turns single sign-on off again. Put this line in your `.env` and plain `docker compose up -d` picks up both from then on:

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.oidc.yml
```

Swap the first name for whichever file you started with, such as `docker-compose.ghcr.yml`.

A **Continue with SSO** button then appears on the login screen. `OIDC_NAME` fills in the blank, so `OIDC_NAME=Acme ID` gives you **Continue with Acme ID**. If that shape is not the sentence you want, `OIDC_LABEL` sets the whole button instead, for example `OIDC_LABEL=Sign in with your Acme account`. Setting both is fine; the label is the more specific of the two, so it wins.

If you set some of these four and not others, nothing starts and you are told which one is missing. This is deliberate: a half-configured provider would otherwise look fine until somebody pressed the button.

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

### Making It the Only Way In

By default a password and your provider work side by side. To turn the password off entirely:

```bash
OIDC_ONLY=true
```

The login screen then shows only the provider button, the password form is gone, **Settings** stops offering to change a password, and an admin has no **Set new password** action, because a password set on this instance could not be used to sign in with.

This is worth doing when you want one place that decides who your people are. Suspending somebody at your provider then locks them out of Parcourse too, which is not true while a password of their own still works.

The thing to weigh is what happens when your provider is unreachable: nobody signs in until it comes back. There is no fallback password by design, because a fallback is also a second credential you have to keep track of. If you need to get in, set `OIDC_ONLY=false` and restart, and the password form comes back exactly as it was.

Parcourse will not start with `OIDC_ONLY=true` and no provider configured, since that would take the only way in away and put nothing in its place.

Turning it on for an instance that already has people does not delete their stored passwords. Nothing will accept one while the setting is on, and if you ever turn it off again those passwords work as they did before.

### Existing Accounts

An account created before you set up single sign-on still has whatever password the admin gave it.

If that password was never changed, it is discarded the first time its owner signs in through your provider. The account becomes provider-only from that point, which prevents an unused password an admin once chose from remaining a valid way in.

This applies to any password an admin set that its owner has not replaced, including one from **Set new password** or from `manage reset-password`. If you reset somebody's password and they then sign in through the provider instead, the password you gave them stops working. Tell them to use the provider, or ask them to change the password themselves first.

If the person had already changed their password themselves, they keep it, and can carry on using either method.

## What Happens After Linking

An account is linked to your provider using the issuer and the subject identifier, not the email address. If somebody changes their email address at your provider, they still sign in to the same Parcourse account, with their courses, notes and knowledge graph intact.

If you are locked out entirely, including the admin password, [Backups and Recovery](/self-hosting/backups) explains how to reset it from the host.
