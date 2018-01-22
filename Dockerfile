from node:8-alpine

RUN mkdir jira-redmine
WORKDIR jira-redmine

COPY package.json .
RUN yarn install --production

COPY . .

ENTRYPOINT ["yarn", "start"]
