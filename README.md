# Twitch for EvntBoard

## Config

```json5
{
    "name": "twitch", // if no name is provided default value is "twitch"
    "config": {
      "client_id": "muSuperClientId", 
      "token": "mySuperAccessToken"
    }
}
```

## Multiple config

Name property should be different :)
Otherwise you can filter event from the specific source !

```json5
[
  {
    "name": "twitch-streaming", // if no name is provided default value is "twitch"
    "config": {
      "client_id": "muSuperClientId",
      "token": "mySuperAccessToken"
    }
  },
  {
    "name": "twitch-gaming", // if no name is provided default value is "twitch"
    "config": {
      "client_id": "muSuperSecondClientId",
      "token": "mySuperSecondAccessToken"
    }
  }
]
```
