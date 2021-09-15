# Twitch for EvntBoard

## Config

```json5
{
  "host": "localhost", // EvntBoard HOST
  "port": 5001, // Evntboard PORT
  "config": {
    "name": "twitch", // if no name is provided default value is "twitch"
    "clientId": "muSuperClientId", 
    "accessToken": "mySuperAccessToken"
  }
}
```

## Multiple config

Name property should be different :)
Otherwise you can filter event from the specific source !

```json5
{
  "host": "localhost", // EvntBoard HOST
  "port": 5001, // Evntboard PORT
  "config": [
    {
      "name": "twitch-streaming", // if no name is provided default value is "twitch-1"
      "clientId": "muSuperClientId",
      "accessToken": "mySuperAccessToken"
    },
    {
      "name": "twitch-gaming", // if no name is provided default value is "twitch-2"
      "clientId": "muSuperSecondClientId",
      "accessToken": "mySuperSecondAccessToken"
    }
  ]
}
```
