# Clean-room test: node 20 + texlive, nothing else.
FROM node:20-bookworm

# Install TeX Live (minimal + needed packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

# Install triton-latex from npm (the PUBLISHED package, not local)
RUN npm i -g @cristianormazabal/triton-latex@0.1.1

# Create working directory
WORKDIR /test

# Copy test files
COPY test-triton.tex .
COPY diagrams/ diagrams/

# Copy triton.sty from the installed npm package
RUN cp "$(npm root -g)/@cristianormazabal/triton-latex/triton.sty" .

# The test script
COPY run-tests.sh .
RUN chmod +x run-tests.sh

CMD ["./run-tests.sh"]
