FROM node:10.12.0

# Install location
ENV dir /var/www/sender
ENV ldf_dir /var/www/ldf-server
ENV ldf_config ${ldf_dir}/config-source.json

# Copy the server files
ADD . ${dir}

# Install the node module
RUN apt-get update && \
    apt-get install -y g++ make python git && \
    cd ${dir} && npm install && \
    apt-get remove -y g++ make python && apt-get autoremove -y && \
    rm -rf /var/cache/apt/archives

# Expose the default port
EXPOSE 3001

# Run base binary
WORKDIR ${dir}
CMD npm run sender ${ldf_dir} ${ldf_config}
