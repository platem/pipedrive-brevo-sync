# Brevo API Docs

## Authentication

api-key
string
The API key should be passed in the request headers as api-key for authentication.

## POST https://api.brevo.com/v3/contacts/import

Values to import contacts in Brevo. To know more about the expected format, please have a look at https://help.brevo.com/hc/en-us/articles/209499265-Build-contacts-lists-for-your-email-marketing-campaigns

### Request Body

disableNotification
boolean
Optional
Defaults to false
To disable email notification

emailBlacklist
boolean
Optional
Defaults to false
To blacklist all the contacts for email

emptyContactsAttributes
boolean
Optional
Defaults to false
To facilitate the choice to erase any attribute of the existing contacts with empty value. emptyContactsAttributes = true means the empty fields in your import will erase any attribute that currently contain data in Brevo, & emptyContactsAttributes = false means the empty fields will not affect your existing data ( **only available if updateExistingContacts set to true **)

jsonBody
list of objects
Optional
Mandatory if fileUrl and fileBody is not defined. JSON content to be imported. Maximum allowed json body size is 10MB . However we recommend a safe limit of around 8 MB to avoid the issues caused due to increase of json body size while parsing. Please use fileUrl instead to import bigger files.

```json
{
  "email": "",
  "attributes": {
    "FIRSTNAME": "",
    "LASTNAME": "",
    "EXT_ID": ""
  }
}
```

map from strings to any
Optional
List of attributes to be imported
email
string
Optional

listIds
list of longs
Optional
Mandatory if newList is not defined. Ids of the lists in which the contacts shall be imported. For example, [2, 4, 7].

newList
object
Optional
To create a new list and import the contacts into it, pass the listName and an optional folderId.

folderId
long
Optional
Id of the folder where this new list shall be created. Mandatory if listName is not empty

listName
string
Optional
List with listName will be created first and users will be imported in it. Mandatory if listIds is empty.

notifyUrl
string
Optional
format: "url"
URL that will be called once the import process is finished. For reference, https://help.brevo.com/hc/en-us/articles/360007666479

updateExistingContacts
boolean
Optional
Defaults to true
To facilitate the choice to update the existing contacts

### Response

```json
{
  "processId": 78
}
```

## POST https://api.brevo.com/v3/contacts/lists

### Request

Values to create a list

folderId => DEFAULT from .env BREVO_FOLDER_ID
long
Required
Id of the parent folder in which this list is to be created

name
string
Required
Name of the list

### Response

```json
{
  "id": 5
}
```

## POST https://api.brevo.com/v3/contacts/lists/:listId/contacts/remove

Delete a contact from a list

### Path parameters
listId
long
Required
Id of the list

### Request

Request
Emails adresses OR IDs OR EXT_ID attributes of the contacts OR ‘all’ true

ContactsRemoveContactFromListRequest0
object
Required

Hide 1 properties
emails
list of strings
Optional
Required if ‘all’ is false and ‘ids’, ‘extIds’ are empty. Emails to remove from a list. You can pass a maximum of 150 emails for removal in one request.

OR
ContactsRemoveContactFromListRequest1
object
Required

Hide 1 properties
ids
list of longs
Optional
Required if ‘all’ is false and ‘emails’, ‘extIds’ are empty. IDs to remove from a list. You can pass a maximum of 150 IDs for removal in one request.

OR
ContactsRemoveContactFromListRequest2
object
Required

Hide 1 properties
all
boolean
Optional
Required if ‘emails’, ‘extIds’ and ‘ids’ are empty. Remove all existing contacts from a list. A process will be created in this scenario. You can fetch the process details to know about the progress

OR
ContactsRemoveContactFromListRequest3
object
Required

Hide 1 properties
extIds
list of strings
Optional
Required if ‘all’ is false, ‘ids’ and ‘emails’ are empty. EXT_ID attributes to remove from a list. You can pass a maximum of 150 EXT_ID attributes for removal in one request.

### Response

[Example when all is passed as true]

```json
{
  "contacts": {
    "failure": [
      "charlie.brown@example.com"
    ],
    "success": [
      "alice.jones@example.com",
      "bob.smith@example.com"
    ]
  }
}
```
