# 注册

```shell
curl --location --request POST 'http://localhost:3001/api/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "test",
    "password": "test"
}'
```

响应

```json
{
    "code": 200,
    "message": "注册成功",
    "data": {
        "userId": "07b291fd-3684-4b61-8617-212cd50817b4",
        "username": "test"
    }
}
```

# 登录

```shell
curl --location --request POST 'http://localhost:3001/api/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "test",
    "password": "test"
}'
```

响应

```json
{
    "code": 200,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ",
        "user": {
            "id": "07b291fd-3684-4b61-8617-212cd50817b4",
            "username": "test",
            "avatar": "default-avatar.png"
        }
    }
}
```


# 获取用户信息

```shell
curl --location --request GET 'http://localhost:3001/api/user/info' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ'
```

这里需要带上Authorization认证信息 即登录接口返回的token

响应

```json
{
    "code": 200,
    "data": {
        "id": "07b291fd-3684-4b61-8617-212cd50817b4",
        "username": "test",
        "avatar": "default-avatar.png"
    }
}
```


# 添加好友

```shell
curl --location --request POST 'http://localhost:3001/api/friend/add' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ' \
--header 'Content-Type: application/json' \
--data-raw '{
    "friendUsername": "test2"
}'
```

响应

```json
{
    "code": 200,
    "message": "添加好友成功",
    "data": {
        "friendId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b",
        "friendUsername": "test2"
    }
}
```

# 备注好友

```shell
curl --location --request POST 'http://localhost:3001/api/friend/remark' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ' \
--header 'Content-Type: application/json' \
--data-raw '{
    "friendId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b",
    "remark": "测试好友"
}'
```

响应

```json
{
    "code": 200,
    "message": "修改备注成功",
    "data": {
        "remark": "测试好友"
    }
}
```

# 获取好友列表

```shell
curl --location --request GET 'http://localhost:3001/api/friend/list' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ'
```

响应

```json
{
    "code": 200,
    "data": [
        {
            "friendId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b",
            "username": "test2",
            "avatar": "default-avatar.png",
            "remark": "测试好友"
        }
    ]
}
```


# 发送消息

```shell
curl --location --request POST 'http://localhost:3001/api/message/send' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ' \
--header 'Content-Type: application/json' \
--data-raw '{
    "receiverId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b",
    "content": "测试消息"
}'
```

响应

```json
{
    "code": 200,
    "message": "消息发送成功",
    "data": {
        "id": "db134d6d-0016-4ccd-b114-35812aef3386",
        "senderId": "07b291fd-3684-4b61-8617-212cd50817b4",
        "receiverId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b",
        "content": "测试消息",
        "sendTime": "2026-01-17T12:21:12.400Z",
        "isRead": 0
    }
}
```


# 获取和好友的历史消息

```shell
curl --location --request GET 'http://localhost:3001/api/message/history?friendId=435fc4b0-489c-46a0-9fcf-cbeb1019f58b' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ'
```

响应

```json
{
    "code": 200,
    "data": [
        {
            "id": "db134d6d-0016-4ccd-b114-35812aef3386",
            "senderId": "07b291fd-3684-4b61-8617-212cd50817b4",
            "receiverId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b",
            "content": "测试消息",
            "sendTime": "2026-01-17 12:21:12",
            "isRead": 0
        }
    ]
}
```


# 获取实时消息

```shell
curl -N -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQzNWZjNGIwLTQ4OWMtNDZhMC05ZmNmLWNiZWIxMDE5ZjU4YiIsInVzZXJuYW1lIjoidGVzdDIiLCJpYXQiOjE3Njg2NTI3MDYsImV4cCI6MTc2OTI1NzUwNn0.EPRqp5C3o-P1yjs4adIzzkOCLVNSSWoGWdlKKwdvygU" -H "Accept: text/event-stream" http://localhost:3001/api/sse/connect
```

该接口为sse接口 消息如下

```json
{
    "type": "message", 
    "data": {
        "sendTime": "2026-01-17T12:26:41.952Z", 
        "senderId": "07b291fd-3684-4b61-8617-212cd50817b4", 
        "receiverId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b", 
        "isRead": 0, 
        "id": "337a9bd2-c7a6-49f7-9d41-fc8bb460478d", 
        "content": "测试消息2"
    }
}
```

# 删除好友

```shell
curl --location --request POST 'http://localhost:3001/api/friend/delete' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YjI5MWZkLTM2ODQtNGI2MS04NjE3LTIxMmNkNTA4MTdiNCIsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTc2ODY1MTc5OSwiZXhwIjoxNzY5MjU2NTk5fQ.ad03XoTbCkdPhCk2CWxqF9DD9Qbb5wLBeSNkqRJRxvQ' \
--header 'Content-Type: application/json' \
--data-raw '{
    "friendId": "435fc4b0-489c-46a0-9fcf-cbeb1019f58b"
}'
```

响应

```json
{
    "code": 200,
    "message": "删除好友成功"
}
```


