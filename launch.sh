docker rm -f redmine-jira-bridge
docker network create redmine-bridge
npm run docker && docker run -d -p 80:80 --network redmine-bridge -e JIRAPASSWORD=$JIRAPASSORD -e JIRALOGIN=$JIRALOGIN -e REDMINE_URL=$REDMINE_URL -e REDMINE_TOKEN=$REDMINE_TOKEN --name=redmine-jira-bridge coopengo/redmine-jira-bridge:$(node -pe "require('./package.json').version")
