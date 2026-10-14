Staging directory for extra CA certificates baked into the agent image.

`container/build-prep.sh` copies the certificates from `NANOCLAW_EXTRA_CA_DIR`
here before each build, for hosts whose outbound HTTPS is re-signed by a
TLS-inspecting proxy, and the host's CA bundle (`host-ca-bundle.pem`) when
`NANOCLAW_DEBIAN_MIRROR` is an https:// URL. Only this README is committed; with
neither setting the directory holds nothing else and the Dockerfile steps that
read it are no-ops.
