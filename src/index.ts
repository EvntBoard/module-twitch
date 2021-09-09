require('dotenv').config();
import { EvntComNode } from "evntcom-js/dist/node";
import { ChatClient } from "@twurple/chat";
import { PubSubClient, PubSubListener } from "@twurple/pubsub";
import { ApiClient, HelixPrivilegedUser } from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";
import { ETwitchEvent } from "./ETwitchEvent";

const NAME: string = process.env.EVNTBOARD_CONFIG_NAME || "twitch"
const CLIENT_ID: string = process.env.EVNTBOARD_CONFIG_CLIENT_ID
const TOKEN: string = process.env.EVNTBOARD_CONFIG_TOKEN

const evntCom = new EvntComNode({
  name: NAME,
  port: 5001,
  host: 'localhost'
});

let chatClient: ChatClient;
let pubSubClient: PubSubClient;
let currentUser: HelixPrivilegedUser;
let cpListener: PubSubListener<never>;
let bitsListener: PubSubListener<never>;
let apiClient: ApiClient;

evntCom.onOpen = async () => {
  await unload() // ...
  await evntCom.callMethod("newEvent", [
    ETwitchEvent.LOAD,
    null,
    { emitter: NAME },
  ]);
  const authProvider = new StaticAuthProvider(CLIENT_ID, TOKEN);
  apiClient = new ApiClient({ authProvider });
  pubSubClient = new PubSubClient();
  await pubSubClient.registerUserListener(authProvider);

  currentUser = await apiClient.users.getMe(false);

  chatClient = new ChatClient({
    webSocket: true,
    channels: [currentUser.name],
    isAlwaysMod: true,
    authProvider,
  });

  chatClient.onConnect(() => {
    evntCom.callMethod("newEvent", [
      ETwitchEvent.OPEN,
      null,
      { emitter: NAME },
    ]);
  });

  chatClient.onDisconnect(async () => {
    await unload()
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.CLOSE,
      null,
      { emitter: NAME },
    ]);
  });

  // Fires when a user redeems channel points
  cpListener = await pubSubClient.onRedemption(currentUser.id, (msg) => {
    evntCom.callMethod("newEvent", [
      ETwitchEvent.CHANNEL_POINT,
      {
        id: msg.id,
        userId: msg.userId,
        userName: msg.userName,
        userDisplayName: msg.userDisplayName,
        channelId: msg.channelId,
        redemptionDate: msg.redemptionDate,
        rewardId: msg.rewardId,
        rewardTitle: msg.rewardTitle,
        rewardPrompt: msg.rewardPrompt,
        rewardCost: msg.rewardCost,
        rewardIsQueued: msg.rewardIsQueued,
        rewardImage: msg.rewardImage,
        defaultImage: msg.defaultImage,
        message: msg.message,
        status: msg.status,
      },
      { emitter: NAME },
    ]);
  });

  bitsListener = await pubSubClient.onBits(currentUser.id, (msg) => {
    evntCom.callMethod("newEvent", [
      ETwitchEvent.BITS,
      {
        userId: msg.userId,
        userName: msg.userName,
        bits: msg.bits,
        totalBits: msg.totalBits,
        isAnonymous: msg.isAnonymous,
        message: msg.message,
        msg,
      },
      { emitter: NAME },
    ]);
  });

  // Fires when a user sends a message to a channel.
  chatClient.onMessage(async (channel, _, message, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.MESSAGE,
      {
        id: msg.id,
        msgId: msg.tags.get("msg-id"),
        isCheer: msg.isCheer,
        bits: msg.bits,
        message,
        userName: msg.userInfo.userName,
        user: {
          userId: msg.userInfo.userId,
          userName: msg.userInfo.userName,
          userType: msg.userInfo.userType,
          displayName: msg.userInfo.displayName,
          isBroadcaster: msg.userInfo.isBroadcaster,
          isFounder: msg.userInfo.isFounder,
          isMod: msg.userInfo.isMod,
          color: msg.userInfo.color,
          isSubscriber: msg.userInfo.isSubscriber,
        },
      },
      { emitter: NAME },
    ]);
  });

  // Fires when a user sends an action (/me) to a channel.
  chatClient.onAction(async (channel, _, message, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.ACTION,
      {
        id: msg.id,
        isCheer: msg.isCheer,
        bits: msg.bits,
        message,
        userName: msg.userInfo.userName,
        user: {
          userId: msg.userInfo.userId,
          userName: msg.userInfo.userName,
          userType: msg.userInfo.userType,
          displayName: msg.userInfo.displayName,
          isBroadcaster: msg.userInfo.isBroadcaster,
          isFounder: msg.userInfo.isFounder,
          isMod: msg.userInfo.isMod,
          color: msg.userInfo.color,
          isSubscriber: msg.userInfo.isSubscriber,
        },
      },
      { emitter: NAME },
    ]);
  });

  // Fires when a user is permanently banned from a channel.
  chatClient.onBan(async (channel, user) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.BAN,
      { user },
      { emitter: NAME },
    ]);
  });

  // Fires when a user upgrades their bits badge in a channel.
  chatClient.onBitsBadgeUpgrade(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.BITS_BADGE_UPGRADE,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when the chat of a channel is cleared.
  chatClient.onChatClear(async (user) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.CHAT_CLEAR,
      { user },
      { emitter: NAME },
    ]);
  });

  // Fires when a user pays forward a subscription that was gifted to them to the community.
  chatClient.onCommunityPayForward(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.COMMUNITY_PAY_FORWARD,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user gifts random subscriptions to the community of a channel.
  chatClient.onCommunitySub(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.COMMUNITY_SUB,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when emote-only mode is toggled in a channel.
  chatClient.onEmoteOnly(async (channel, enabled) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.EMOTE_ONLY,
      { enabled },
      { emitter: NAME },
    ]);
  });

  // Fires when followers-only mode is toggled in a channel.
  chatClient.onFollowersOnly(async (channel, enabled, delay) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.FOLLOWER_ONLY,
      { enabled, delay },
      { emitter: NAME },
    ]);
  });

  // Fires when a user upgrades their gift subscription to a paid subscription in a channel.
  chatClient.onGiftPaidUpgrade(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.GIFT_PAID_UPGRADE,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a channel hosts another channel.
  chatClient.onHost(async (channel, target, viewers) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.HOST,
      { target, viewers },
      { emitter: NAME },
    ]);
  });

  // Fires when a channel you're logged in as its owner is being hosted by another channel.
  chatClient.onHosted(async (channel, byChannel, auto, viewers) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.HOSTED,
      { channel: byChannel, auto, viewers },
      { emitter: NAME },
    ]);
  });

  // Fires when Twitch tells you the number of hosts you have remaining in the next half hour for the channel for which you're logged in as owner after hosting a channel.
  chatClient.onHostsRemaining(async (channel, numberOfHosts) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.HOST_REMAINING,
      { numberOfHosts },
      { emitter: NAME },
    ]);
  });

  // Fires when a user joins a channel.
  chatClient.onJoin(async (channel, user) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.JOIN,
      { user },
      { emitter: NAME },
    ]);
  });

  // Fires when a user sends a message to a channel.
  chatClient.onPart(async (channel, user) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.PART,
      { user },
      { emitter: NAME },
    ]);
  });

  // Fires when a user gifts a Twitch Prime benefit to the channel.
  chatClient.onPrimeCommunityGift(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.PRIME_COMMUNITY_GIFT,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
  chatClient.onPrimePaidUpgrade(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.PRIME_PAID_UPGRADE,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
  chatClient.onR9k(async (channel, enabled) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.R9K,
      { enabled },
      { emitter: NAME },
    ]);
  });

  // Fires when a user raids a channel.
  chatClient.onRaid(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.RAID,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user cancels a raid.
  chatClient.onRaidCancel(async (channel, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.RAID_CANCEL,
      { msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user resubscribes to a channel.
  chatClient.onResub(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.RESUB,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user gifts rewards during a special event.
  chatClient.onRewardGift(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.REWARD_GIFT,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user performs a "ritual" in a channel. WTF ?!
  chatClient.onRitual(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.RITUAL,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when slow mode is toggled in a channel.
  chatClient.onSlow(async (channel, enabled, delay) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.SLOW,
      { enabled, delay },
      { emitter: NAME },
    ]);
  });

  // Fires when a user pays forward a subscription that was gifted to them to a specific user.
  chatClient.onStandardPayForward(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.STANDARD_PAY_FORWARD,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user subscribes to a channel.
  chatClient.onSub(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.SUB,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user extends their subscription using a Sub Token.
  chatClient.onSubExtend(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.SUB_EXTEND,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when a user gifts a subscription to a channel to another user.
  chatClient.onSubGift(async (channel, user, info, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.SUB_GIFT,
      { user, info, msg },
      { emitter: NAME },
    ]);
  });

  // Fires when sub only mode is toggled in a channel.
  chatClient.onSubsOnly(async (channel, enabled) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.SUB_ONLY,
      { enabled },
      { emitter: NAME },
    ]);
  });

  // Fires when a user is timed out from a channel.
  chatClient.onTimeout(async (channel, user, duration) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.TIMEOUT,
      { user, duration },
      { emitter: NAME },
    ]);
  });

  // Fires when host mode is disabled in a channel.
  chatClient.onUnhost(async (channel) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.UNHOST,
      { channel },
      { emitter: NAME },
    ]);
  });

  // Fires when receiving a whisper from another user.
  chatClient.onWhisper(async (user, message, msg) => {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.WHISPER,
      { user, message, msg },
      { emitter: NAME },
    ]);
  });

  await chatClient.connect();
};

const unload = async () => {
  if (chatClient) {
    await chatClient.quit();
  }

  if (cpListener) {
    await cpListener.remove();
  }

  if (bitsListener) {
    await bitsListener.remove();
  }

  apiClient = undefined;
  chatClient = undefined;
  currentUser = undefined;
  pubSubClient = undefined;
  cpListener = undefined;
  bitsListener = undefined;
};

// chat API

const say = async (message: string, reply: string) =>
  chatClient?.say(currentUser.name, message, { replyTo: reply });

const me = async (message: string) => chatClient?.action(currentUser.name, message);

const whisp = async (user: string, message: string) =>
  chatClient?.whisper(user, message);

evntCom.expose("say", say);
evntCom.expose("me", me);
evntCom.expose("whisp", whisp);

// Helix Channel

const channelGetChannelEditors = async () => {
  return await apiClient.channels.getChannelEditors(currentUser.id);
};

const channelGetInfo = async () => {
  return await apiClient.channels.getChannelInfo(currentUser.id)
};

const channelUpdateTitle = async (title: string) => {
  return await apiClient.channels.updateChannelInfo(currentUser.id, { title });
};

const channelUpdateGame = async (game: string) => {
  let gameObj = await apiClient.games.getGameByName(game);
  return await apiClient.channels.updateChannelInfo(currentUser.id, {
    gameId: gameObj?.id || game,
  });
};

const channelUpdateLanguage = async (language: string) => {
  return await apiClient.channels.updateChannelInfo(currentUser.id, {
    language,
  });
};

const channelStartCommercial = async (
  duration: 30 | 60 | 90 | 120 | 150 | 180
) => {
  return await apiClient.channels.startChannelCommercial(
    currentUser.id,
    duration
  );
};

const usersGetUserByName = async (user: string) => {
  const data = await apiClient.users.getUserByName(user);
  return {
    broadcasterType: data.broadcasterType,
    creationDate: data.creationDate,
    description: data.description,
    displayName: data.displayName,
    id: data.id,
    name: data.name,
    offlinePlaceholderUrl: data.offlinePlaceholderUrl,
    profilePictureUrl: data.profilePictureUrl,
    type: data.type,
    views: data.views,
  };
};

evntCom.expose("channelGetInfo", channelGetInfo);
evntCom.expose("channelGetChannelEditors", channelGetChannelEditors);
evntCom.expose("channelUpdateTitle", channelUpdateTitle);
evntCom.expose("channelUpdateGame", channelUpdateGame);
evntCom.expose("channelUpdateLanguage", channelUpdateLanguage);
evntCom.expose("channelStartCommercial", channelStartCommercial);
evntCom.expose("usersGetUserByName", usersGetUserByName);