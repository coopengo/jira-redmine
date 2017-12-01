docker rm -f redmine-jira-bridge
docker network create redmine-bridge
npm run docker && docker run -d -p 80:80 --network redmine-bridge -e BOT_ID=$BOT_ID -e JIRA_URL=$JIRA_URL -e JIRA_PASSWORD=$JIRA_PASSWORD -e JIRA_LOGIN=$JIRA_LOGIN -e REDMINE_URL=$REDMINE_URL -e REDMINE_JIRA_TOKEN=$REDMINE_TOKEN --name=redmine-jira-bridge coopengo/redmine-jira-bridge:$(node -pe "require('./package.json').version")
