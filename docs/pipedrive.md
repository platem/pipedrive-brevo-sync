# Pipedrive API Docs

## GET/v1/filters

### Query parameters

type
string
The types of filters to fetch

Values: deals, leads, org, people, products, activity, projects

### Response

```json
{"success":true,"data":[{"id":1,"name":"All open deals","active_flag":true,"type":"deals","temporary_flag":null,"user_id":927097,"add_time":"2019-10-15 11:01:53","update_time":"2019-10-15 11:01:53","visible_to":7,"custom_view_id":1}]}
```

## GET/api/v2/deals

### Query parameters

filter_id
integer
If supplied, only deals matching the specified filter are returned

pipeline_id
integer
If supplied, only deals in the specified pipeline are returned. If filter_id is provided, this is ignored.

stage_id
integer
If supplied, only deals in the specified stage are returned. If filter_id is provided, this is ignored.

status
string
Only fetch deals with a specific status. If omitted, all not deleted deals are returned. If set to deleted, deals that have been deleted up to 30 days ago will be included. Multiple statuses can be included as a comma separated array. If filter_id is provided, this is ignored.

Values

open
won
lost
deleted

limit
integer
For pagination, the limit of entries to be returned. If not provided, 100 items will be returned. Please note that a maximum value of 500 is allowed.

cursor
string
For pagination, the marker (an opaque string value) representing the first item on the next page

### Response

```json
{"success":true,"data":[{"id":1,"title":"Deal Title","creator_user_id":1,"owner_id":1,"value":200,"person_id":1,"org_id":1,"stage_id":1,"pipeline_id":1,"currency":"USD","archive_time":"2021-01-01T00:00:00Z","add_time":"2021-01-01T00:00:00Z","update_time":"2021-01-01T00:00:00Z","stage_change_time":"2021-01-01T00:00:00Z","status":"open","is_archived":false,"is_deleted":false,"probability":90,"lost_reason":"Lost Reason","visible_to":7,"close_time":"2021-01-01T00:00:00Z","won_time":"2021-01-01T00:00:00Z","lost_time":"2021-01-01T00:00:00Z","local_won_date":"2021-01-01","local_lost_date":"2021-01-01","local_close_date":"2021-01-01","expected_close_date":"2021-01-01","label_ids":[1,2,3],"origin":"ManuallyCreated","origin_id":null,"channel":52,"channel_id":"Jun23 Billboards","acv":120,"arr":120,"mrr":10,"custom_fields":{}}],"additional_data":{"next_cursor":"eyJmaWVsZCI6ImlkIiwiZmllbGRWYWx1ZSI6Nywic29ydERpcmVjdGlvbiI6ImFzYyIsImlkIjo3fQ"}}
```

## GET/api/v2/persons

### Query parameters

filter_id
integer
If supplied, only persons matching the specified filter are returned

ids
string
Optional comma separated string array of up to 100 entity ids to fetch. If filter_id is provided, this is ignored. If any of the requested entities do not exist or are not visible, they are not included in the response.

owner_id
integer
If supplied, only persons owned by the specified user are returned. If filter_id is provided, this is ignored.

org_id
integer
If supplied, only persons linked to the specified organization are returned. If filter_id is provided, this is ignored.

deal_id
integer
If supplied, only persons linked to the specified deal are returned. If filter_id is provided, this is ignored.

limit
integer
For pagination, the limit of entries to be returned. If not provided, 100 items will be returned. Please note that a maximum value of 500 is allowed.

cursor
string
For pagination, the marker (an opaque string value) representing the first item on the next page

### Response

```json
{"success":true,"data":[{"id":1,"name":"Person Name","first_name":"Person","last_name":"Name","owner_id":1,"org_id":1,"add_time":"2021-01-01T00:00:00Z","update_time":"2021-01-01T00:00:00Z","emails":[{"value":"email1@email.com","primary":true,"label":"work"},{"value":"email2@email.com","primary":false,"label":"home"}],"phones":[{"value":"12345","primary":true,"label":"work"},{"value":"54321","primary":false,"label":"home"}],"is_deleted":false,"visible_to":7,"label_ids":[1,2,3],"picture_id":1,"custom_fields":{},"notes":"Notes from contact sync","im":[{"value":"skypeusername","primary":true,"label":"skype"},{"value":"whatsappusername","primary":false,"label":"whatsapp"}],"birthday":"2000-12-31","job_title":"Manager","postal_address":{"value":"123 Main St","country":"USA","admin_area_level_1":"CA","admin_area_level_2":"Santa Clara","locality":"Sunnyvale","sublocality":"Downtown","route":"Main St","street_number":"123","subpremise":"Apt 1","postal_code":"94085"}}],"additional_data":{"next_cursor":"eyJmaWVsZCI6ImlkIiwiZmllbGRWYWx1ZSI6Nywic29ydERpcmVjdGlvbiI6ImFzYyIsImlkIjo3fQ"}}
```
