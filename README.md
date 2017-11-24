Jira Redmine Bridge

TO DO :

- [x] Jira to Redmine Issue Transfer 
  - [x] Transfer issue Jira when type is bug or new feature 
  - [x] Synchronize Jira status to Redmine.
    - [x] Need a mapping of status 
    - [x] Map priority, tracker(start at 10000 in Jira and 1 in Redmine) 
  - [x] Subject is the Jira issue key + : and the real subject 

- [x] Redmine to Jira issue Update
  - [x] Load the plugin
  - [x] Synchronize Redmine change to Jira

- [x] Jira comment transfer to Redmine
  - [x] Plug webhook to created comment

O) Optionals
   - [ ] \(Optional) Update Redmine plugin to separate issue and comment change


Be careful the project identifier in Redmine should be the same
project key in Jira **but** Redmine is in lowerCase and Jira
in **UPERCASE**
