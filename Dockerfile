from node:8-alpine

RUN mkdir redmine-jira-bridge

WORKDIR redmine-jira-bridge
COPY package.json . 

RUN npm i --production
COPY server.js .



ENTRYPOINT ["npm", "start"]
