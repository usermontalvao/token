FROM alpine:3.22

ARG TARGETARCH
ARG VH_SHA256=""

RUN apk add --no-cache ca-certificates curl iproute2 tini \
    && case "${TARGETARCH}" in \
         amd64) vh_binary="vhusbdx86_64" ;; \
         arm64) vh_binary="vhusbdarm64" ;; \
         arm) vh_binary="vhusbdarm" ;; \
         386) vh_binary="vhusbdi386" ;; \
         *) echo "Arquitetura nao suportada: ${TARGETARCH}" >&2; exit 1 ;; \
       esac \
    && curl --fail --show-error --silent --location \
         "https://www.virtualhere.com/sites/default/files/usbserver/${vh_binary}" \
         --output /usr/local/bin/vhusbd \
    && if [ -n "${VH_SHA256}" ]; then \
         printf '%s  %s\n' "${VH_SHA256}" /usr/local/bin/vhusbd | sha256sum -c -; \
       else \
         expected_sha1="$(curl --fail --show-error --silent --location \
           https://www.virtualhere.com/sites/default/files/usbserver/SHA1SUM \
           | awk -v file="${vh_binary}" '$2 == file { print $1; exit }')"; \
         test -n "${expected_sha1}"; \
         printf '%s  %s\n' "${expected_sha1}" /usr/local/bin/vhusbd | sha1sum -c -; \
       fi \
    && chmod 0755 /usr/local/bin/vhusbd

COPY entrypoint.sh /usr/local/bin/jurius-entrypoint
RUN chmod 0755 /usr/local/bin/jurius-entrypoint

VOLUME ["/config"]
EXPOSE 7575/tcp

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD nc -z "${VH_BIND_ADDRESS:-10.254.75.75}" "${VH_TCP_PORT:-7575}" || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/jurius-entrypoint"]
