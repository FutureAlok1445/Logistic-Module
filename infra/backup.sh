#!/bin/sh
set -eu
# Run inside the database container or a host with PostgreSQL client tools.
# PGPASSWORD is supplied by a secret manager, never by a command-line argument.
: "${PGDATABASE:?Set PGDATABASE}"
: "${BACKUP_DIR:?Set BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"
pg_dump -Fc -f "$BACKUP_DIR/elms-$(date -u +%Y%m%dT%H%M%SZ).dump"
# Keep at least one year. Production backup storage must be encrypted and off-site.
find "$BACKUP_DIR" -type f -name 'elms-*.dump' -mtime +366 -delete
