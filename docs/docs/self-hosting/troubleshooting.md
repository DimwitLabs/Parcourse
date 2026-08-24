---
id: troubleshooting
title: Troubleshooting
---

# Troubleshooting

Most of what goes wrong with a Parcourse instance is one of a handful of things, and none of them are subtle once you know where to look.

## A Video Will Not Load on a VPS

YouTube refuses transcript requests from datacenter addresses, so a server rented anywhere is told to prove it is not a bot, while the same app on a home machine works untouched.

The fix is to make only the YouTube fetches leave from somewhere else. Point `YTDLP_PROXY` at any proxy, `http://` or `socks5h://`, from a provider or from the VPN sidecar Parcourse ships:

```bash
docker compose -f docker-compose.ghcr-vpn.yml up
```

That file wants your provider's **OpenVPN** credentials, which are not the ones their website logs you in with:

```
VPN_SERVICE_PROVIDER=protonvpn
OPENVPN_USER=
OPENVPN_PASSWORD=
FREE_ONLY=off
```

Leave `YTDLP_PROXY` empty when running at home, where the connection is already residential.

### When One Address Runs Out of Welcome

A single address gets turned away eventually. When that happens, Parcourse can ask the VPN for a different server and try again, waiting less on each attempt, and only says so once the reconnects have all been refused.

| Variable | What it does |
| --- | --- |
| `VPN_ROTATIONS` | How many reconnects to try. `0` keeps the address it started on. |
| `VPN_CONTROL_URL` | Where the reconnect is requested. The bundled VPN answers on `http://vpn:8000`. |

:::warning
Rotation needs both. With only one of them set, nothing rotates.
:::

## Generation Fails, or a Course Comes Back Empty

Usually the provider, not the video. Go to **Settings** and use **Test connection**. It asks the provider for real, so it catches a wrong model name, an expired key, or a local server that is not running.

Nothing checks the model name as you type it, so a typo surfaces here.

## Provider Keys Stopped Working After a Config Change

If `ENCRYPTION_KEY` changed, every stored key became unreadable, because that is the value they were encrypted with. There is no recovery. Put the old value back if you still have it, or have everyone reconnect their provider.

## Signing In Fails After a Restart

If `JWT_SECRET` changed, every issued token is invalid. Everyone signs in again, and that is the whole of it.

## Seeing More from the Backend

```
LOG_LEVEL=debug
```

Accepts `debug`, `info`, `warning`, `error` and `critical`, and defaults to `info`.
