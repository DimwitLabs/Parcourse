---
id: first-run
title: First Run
---

# First Run

An instance with no accounts on it shows a setup screen instead of the sign-in page.

## Creating the Admin Account

The first account you make is the admin account. It is the only one that can add other people, reset their passwords, or clear their progress later, so make it yours rather than a shared one.

There is no way back to this screen. Once an account exists, the instance shows the ordinary sign-in page, and further accounts are made from the admin screen.

## Connecting a Provider

Setup then asks for a model provider. Parcourse has no model of its own, so without one it can read a video but cannot turn it into anything.

You can skip this step and add a provider later from **Settings**. Until you do, the bar on the home screen has nothing to hand a transcript to, and the app will say so.

See [Providers and models](/self-hosting/providers) for what each provider needs and which models are worth starting with.

:::tip
The key you paste is encrypted with `ENCRYPTION_KEY` before it is stored. Lose that value and every stored key becomes unreadable, so keep it with your other secrets rather than only in the `.env` on the box.
:::

## Making the First Course

Paste a YouTube link into the bar on the home screen. Anything that is not a YouTube link is refused as you paste it, and every shape YouTube uses is accepted: `watch`, `youtu.be`, `shorts`, `embed`, `live`, and the mobile and music subdomains.

Generating the course is a wait. Once it is done the page opens, and the cheatsheet is written behind it, so it is usually ready by the time you have read the first section.

If the video will not load at all, see [Troubleshooting](/self-hosting/troubleshooting).
