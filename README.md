# SmartMeter availability monitor for OpenWrt

Original single-target LuCI monitor. Files under `files/` match their paths on the router.

Requires Python 3, nmap, LuCI, rpcd and procd. The service records samples in a local SQLite database.

The live statistics database and router backup archives are intentionally excluded.
