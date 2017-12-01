from node:8-alpine

RUN mkdir redmine-jira-bridge

WORKDIR redmine-jira-bridge
COPY package.json *.js ./
RUN npm i --production

ENTRYPOINT ["npm", "start"]
