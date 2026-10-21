# SmartMeterMonitor for OpenWrt

LuCI availability monitor with independent checks for local devices, IP addresses and web resources. The first commit preserves the original single-target version.

## Checks

- **ARP:** IPv4 address on a local interface, with an optional expected MAC address.
- **ICMP:** Ping an IP address or hostname.
- **HTTP/HTTPS:** GET a URL, follow up to five redirects, verify TLS and compare the final status code.

Each check has its own name, enabled state, interval, timeout and retention period. The LuCI page lets you add, edit, remove and select checks. Each check keeps its history in a separate SQLite database. The original `main` check continues using `/root/smartmeter-availability.sqlite3`. Removing a check leaves its database on disk.

Intervals: 5–3600 seconds. Timeouts: 1–60 seconds. Retention: 1–3650 days. Up to 30 checks can be configured.

## Install

Requires OpenWrt with LuCI, rpcd, Python 3, `nmap`, `curl` and `ping`. Copy the contents of `files/` to `/` on the router, keeping paths and executable bits. For a new installation, copy `files/etc/config/smartmeter-availability.example` to `/etc/config/smartmeter-availability` and edit it. For an existing installation, keep the current config and database; the new service reads the original `main` section.

Then run:

```sh
chmod 755 /usr/bin/smartmeter-availability /usr/libexec/smartmeter-availability-dashboard /usr/libexec/smartmeter-availability-config /etc/init.d/smartmeter-availability
/etc/init.d/rpcd restart
/etc/init.d/smartmeter-availability enable
/etc/init.d/smartmeter-availability restart
```

Open **Services → Мониторинг доступности** in LuCI.

The live SQLite databases, router backups and credentials are excluded from this repository.
