Staging directory for extra CA certificates baked into the agent image.

`container/build-prep.sh` copies the certificates from `NANOCLAW_EXTRA_CA_DIR`
here before each build, for hosts whose outbound HTTPS is re-signed by a
TLS-inspecting proxy. Only this README is committed; with the setting unset the
directory holds nothing else and the Dockerfile step that reads it is a no-op.
