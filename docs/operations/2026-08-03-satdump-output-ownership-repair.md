# SatDump output ownership repair

Date: 2026-08-03

This was a separately approved operational action. It was not performed by application bootstrap or a deployment script.

## Before repair

- Path: `/home/vaggos/satdump_out`
- Size: `12K`
- Root filesystem: `58G` total, `44G` available, `20%` used
- Ownership and mode: `root:root 755`
- A non-sudo create attempt as `vaggos` failed with `Permission denied`.

## Approved action

```sh
sudo chown -R vaggos:vaggos /home/vaggos/satdump_out
```

No mode or retention-policy change was authorized or made.

## Verification

```text
vaggos:vaggos 755 /home/vaggos/satdump_out
```

Creating and removing `/home/vaggos/satdump_out/.orbitforge-write-test` as `vaggos` both succeeded. The probe file was confirmed absent afterward.
