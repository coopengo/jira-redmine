Jira Redmine Bridge

TO DO :

- [ ] Jira to Redmine Issue Transfer 
- [x] Transfer issue Jira when type is bug or new feature 
- [x] Synchronize Jira status to Redmine.
- [ ] Need a mapping of status
   There are two type of status : 
   - a category status
   - a workflow status
   Which one should i map ? 
- [ ] Map priority, tracker 
- [x] Subject is the Jira issue key + : and the real subject 

- [ ] Redmine to Jira issue Update
        a. [ ] Load the plugin
        b. [ ] Synchronize Redmine change to Jira

III) [ ] Jira comment transfer to Redmine
         a. [ ] Plug webhook to created comment

O) Optionals
   a. [ ] Update Redmine plugin to separate issue and comment change


Be careful the project identifier in Redmine should be the same
project key in Jira **but** Redmine is in lowerCase and Jira
in **UPERCASE**
