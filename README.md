# Background

This was a day-project during a hackathon to create an integration for Jira that utilizes an LLM somehow. This example was fully worked to the point of reading in an issue description and posting a comment on the initial Jira ticket.

# Setup

## High level

Some requirements before we can start

- Node
    - The `.nvmrc` allows you to use `nvm install` and `nvm use` to use this project's supported node version.
- AWS access
    - The terminal the deploy command is run from `deploy-all` requires AWS auth. In my case this was done using Single Sign On and programatic access environment variable credentials.
- Don't forget to use `npm i`

## Low level

This project used some existant resources and cannot be deployed as is without modification. This project assumes a few things

- A lambda exists that handles prompt forwarding to an LLM generative AI service.
    - This could be rectified by, instead of sending prompts to some assumed LLM forwarding lambda, using the Open AI API or some similar service's interface.
    - My specific recommendation for a replacement would be to use this library as it fits well with this project and would require minimal LOE to implement: https://github.com/openai/openai-node
- A Jira auth token is saved to your `.env` file.
    - These can be a little tricky as there are many different versions of the Jira API t
        - The one this project uses is v3
    - These two Jira documentation points are a good starting point: 
        - https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/#get-an-api-token
        - https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/#supply-basic-auth-headers

# Developer Notes

- This project is made fairly functionally, only using one singleton `JiraClient` (which isn't strictly enforced).
- There are no programatic tests written currently. This was tested in a non-production environment but was never considered for production.
    - Tests could and should be added for the various pieces of this project if development was ever resumed.