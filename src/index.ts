require("dotenv").config();
import { EvntComNode } from "evntcom-js/dist/node";
import { ChatClient } from "@twurple/chat";
import { PubSubClient, PubSubListener } from "@twurple/pubsub";
import { ApiClient, HelixPrivilegedUser } from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";
import { HelixBitsLeaderboardQuery } from "@twurple/api/lib/api/helix/bits/HelixBitsApi";
import {
  HelixCreateCustomRewardData,
  HelixPaginatedCustomRewardRedemptionFilter,
} from "@twurple/api/lib/api/helix/channelPoints/HelixChannelPointsApi";
import {
  HelixCustomRewardRedemptionStatus,
  HelixCustomRewardRedemptionTargetStatus,
} from "@twurple/api/lib/api/helix/channelPoints/HelixCustomRewardRedemption";
import {
  HelixClipFilter,
  HelixPaginatedClipFilter,
} from "@twurple/api/lib/api/helix/clip/HelixClipApi";
import { ETwitchEvent } from "./ETwitchEvent";

const NAME: string = process.env.EVNTBOARD_NAME || "twitch";
const HOST: string = process.env.EVNTBOARD_HOST || "localhost";
const PORT: number = process.env.EVNTBOARD_PORT ? parseInt(process.env.EVNTBOARD_PORT) : 5001;
const CLIENT_ID: string = process.env.EVNTBOARD_CONFIG_CLIENT_ID;
const TOKEN: string = process.env.EVNTBOARD_CONFIG_TOKEN;

const evntCom = new EvntComNode({
  name: NAME,
  port: PORT,
  host: HOST,
});

let chatClient: ChatClient;
let pubSubClient: PubSubClient;
let currentUser: HelixPrivilegedUser;
let cpListener: PubSubListener<never>;
let bitsListener: PubSubListener<never>;
let apiClient: ApiClient;

evntCom.onOpen = async () => {
  try {
    await unload();
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.LOAD,
      null,
      {emitter: NAME},
    ]);
    const authProvider = new StaticAuthProvider(CLIENT_ID, TOKEN);
    apiClient = new ApiClient({authProvider});
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
        {emitter: NAME},
      ]);
    });

    chatClient.onDisconnect(async () => {
      await unload();
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.CLOSE,
        null,
        {emitter: NAME},
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
        {emitter: NAME},
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
        {emitter: NAME},
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
        {emitter: NAME},
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
        {emitter: NAME},
      ]);
    });

    // Fires when a user is permanently banned from a channel.
    chatClient.onBan(async (channel, user) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.BAN,
        {user},
        {emitter: NAME},
      ]);
    });

    // Fires when a user upgrades their bits badge in a channel.
    chatClient.onBitsBadgeUpgrade(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.BITS_BADGE_UPGRADE,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when the chat of a channel is cleared.
    chatClient.onChatClear(async (user) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.CHAT_CLEAR,
        {user},
        {emitter: NAME},
      ]);
    });

    // Fires when a user pays forward a subscription that was gifted to them to the community.
    chatClient.onCommunityPayForward(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.COMMUNITY_PAY_FORWARD,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user gifts random subscriptions to the community of a channel.
    chatClient.onCommunitySub(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.COMMUNITY_SUB,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when emote-only mode is toggled in a channel.
    chatClient.onEmoteOnly(async (channel, enabled) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.EMOTE_ONLY,
        {enabled},
        {emitter: NAME},
      ]);
    });

    // Fires when followers-only mode is toggled in a channel.
    chatClient.onFollowersOnly(async (channel, enabled, delay) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.FOLLOWER_ONLY,
        {enabled, delay},
        {emitter: NAME},
      ]);
    });

    // Fires when a user upgrades their gift subscription to a paid subscription in a channel.
    chatClient.onGiftPaidUpgrade(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.GIFT_PAID_UPGRADE,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a channel hosts another channel.
    chatClient.onHost(async (channel, target, viewers) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.HOST,
        {target, viewers},
        {emitter: NAME},
      ]);
    });

    // Fires when a channel you're logged in as its owner is being hosted by another channel.
    chatClient.onHosted(async (channel, byChannel, auto, viewers) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.HOSTED,
        {channel: byChannel, auto, viewers},
        {emitter: NAME},
      ]);
    });

    // Fires when Twitch tells you the number of hosts you have remaining in the next half hour for the channel for which you're logged in as owner after hosting a channel.
    chatClient.onHostsRemaining(async (channel, numberOfHosts) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.HOST_REMAINING,
        {numberOfHosts},
        {emitter: NAME},
      ]);
    });

    // Fires when a user joins a channel.
    chatClient.onJoin(async (channel, user) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.JOIN,
        {user},
        {emitter: NAME},
      ]);
    });

    // Fires when a user sends a message to a channel.
    chatClient.onPart(async (channel, user) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.PART,
        {user},
        {emitter: NAME},
      ]);
    });

    // Fires when a user gifts a Twitch Prime benefit to the channel.
    chatClient.onPrimeCommunityGift(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.PRIME_COMMUNITY_GIFT,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
    chatClient.onPrimePaidUpgrade(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.PRIME_PAID_UPGRADE,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
    chatClient.onR9k(async (channel, enabled) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.R9K,
        {enabled},
        {emitter: NAME},
      ]);
    });

    // Fires when a user raids a channel.
    chatClient.onRaid(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.RAID,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user cancels a raid.
    chatClient.onRaidCancel(async (channel, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.RAID_CANCEL,
        {msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user resubscribes to a channel.
    chatClient.onResub(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.RESUB,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user gifts rewards during a special event.
    chatClient.onRewardGift(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.REWARD_GIFT,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user performs a "ritual" in a channel. WTF ?!
    chatClient.onRitual(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.RITUAL,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when slow mode is toggled in a channel.
    chatClient.onSlow(async (channel, enabled, delay) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.SLOW,
        {enabled, delay},
        {emitter: NAME},
      ]);
    });

    // Fires when a user pays forward a subscription that was gifted to them to a specific user.
    chatClient.onStandardPayForward(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.STANDARD_PAY_FORWARD,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user subscribes to a channel.
    chatClient.onSub(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.SUB,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user extends their subscription using a Sub Token.
    chatClient.onSubExtend(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.SUB_EXTEND,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when a user gifts a subscription to a channel to another user.
    chatClient.onSubGift(async (channel, user, info, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.SUB_GIFT,
        {user, info, msg},
        {emitter: NAME},
      ]);
    });

    // Fires when sub only mode is toggled in a channel.
    chatClient.onSubsOnly(async (channel, enabled) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.SUB_ONLY,
        {enabled},
        {emitter: NAME},
      ]);
    });

    // Fires when a user is timed out from a channel.
    chatClient.onTimeout(async (channel, user, duration) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.TIMEOUT,
        {user, duration},
        {emitter: NAME},
      ]);
    });

    // Fires when host mode is disabled in a channel.
    chatClient.onUnhost(async (channel) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.UNHOST,
        {channel},
        {emitter: NAME},
      ]);
    });

    // Fires when receiving a whisper from another user.
    chatClient.onWhisper(async (user, message, msg) => {
      await evntCom.callMethod("newEvent", [
        ETwitchEvent.WHISPER,
        {user, message, msg},
        {emitter: NAME},
      ]);
    });

    await chatClient.connect();
  } catch (e) {
    await evntCom.callMethod("newEvent", [
      ETwitchEvent.CLOSE,
      null,
      {emitter: NAME},
    ]);
  }
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

// Helper

const registerAll = (obj: { [index: string]: any }) => {
  for (let key in obj) {
    evntCom.expose(key, obj[key]);
  }
};

// chat API

registerAll({
  // chat
  say: async (message: string, reply: string) =>
    chatClient?.say(currentUser.name, message, { replyTo: reply }),
  me: async (message: string) => chatClient?.action(currentUser.name, message),
  whisp: async (user: string, message: string) =>
    chatClient?.whisper(user, message),
  addVip: async (user: string) => chatClient?.addVip(currentUser.name, user),
  ban: async (user: string, reason: string) =>
    chatClient?.ban(currentUser.name, user, reason),
  changeColor: async (color: string) => chatClient?.changeColor(color),
  clear: async () => chatClient?.clear(currentUser.name),
  disableEmoteOnly: async () => chatClient?.disableEmoteOnly(currentUser.name),
  disableFollowersOnly: async () =>
    chatClient?.disableFollowersOnly(currentUser.name),
  disableR9k: async () => chatClient?.disableR9k(currentUser.name),
  disableSlow: async () => chatClient?.disableSlow(currentUser.name),
  disableSubsOnly: async () => chatClient?.disableSubsOnly(currentUser.name),
  enableEmoteOnly: async () => chatClient?.enableEmoteOnly(currentUser.name),
  enableFollowersOnly: async () =>
    chatClient?.enableFollowersOnly(currentUser.name),
  enableR9k: async () => chatClient?.enableR9k(currentUser.name),
  enableSlow: async () => chatClient?.enableSlow(currentUser.name),
  enableSubsOnly: async () => chatClient?.enableSubsOnly(currentUser.name),
  getMods: async () => chatClient?.getMods(currentUser.name),
  getVips: async () => chatClient?.getMods(currentUser.name),
  host: async (channel: string) => chatClient?.host(currentUser.name, channel),
  mod: async (user: string) => chatClient?.mod(currentUser.name, user),
  purge: async (user: string, reason: string) =>
    chatClient?.purge(currentUser.name, user, reason),
  raid: async (channel: string) => chatClient?.raid(currentUser.name, channel),
  removeVip: async (user: string) =>
    chatClient?.removeVip(currentUser.name, user),
  runCommercial: async (duration: 30 | 60 | 90 | 120 | 150 | 180) =>
    chatClient?.runCommercial(currentUser.name, duration),
  timeout: async (user: string, duration: number, reason: string) =>
    chatClient?.timeout(currentUser.name, user, duration, reason),
  unmod: async (user: string) => chatClient?.unmod(currentUser.name, user),
  unraid: async (channel: string) => chatClient?.unraid(channel),

  // Bits

  bitsGetLeaderboard: async (data?: HelixBitsLeaderboardQuery) => {
    return await apiClient.bits.getLeaderboard(data);
  },
  bitsGetCheermotes: async (channel: string) => {
    return await apiClient.bits.getCheermotes(channel);
  },

  // Channel
  channelGetChannelEditors: async () => {
    return await apiClient.channels.getChannelEditors(currentUser.id);
  },
  channelGetInfo: async () => {
    return await apiClient.channels.getChannelInfo(currentUser.id);
  },
  channelUpdateTitle: async (title: string) => {
    return await apiClient.channels.updateChannelInfo(currentUser.id, {
      title,
    });
  },
  channelUpdateGame: async (game: string) => {
    let gameObj = await apiClient.games.getGameByName(game);
    return await apiClient.channels.updateChannelInfo(currentUser.id, {
      gameId: gameObj?.id || game,
    });
  },
  channelUpdateLanguage: async (language: string) => {
    return await apiClient.channels.updateChannelInfo(currentUser.id, {
      language,
    });
  },
  channelStartCommercial: async (duration: 30 | 60 | 90 | 120 | 150 | 180) => {
    return await apiClient.channels.startChannelCommercial(
      currentUser.id,
      duration
    );
  },

  // ChannelPointsApi
  channelPointsGetCustomRewards: async (onlyManageable?: boolean) => {
    return await apiClient.channelPoints.getCustomRewards(
      currentUser.id,
      onlyManageable
    );
  },
  channelPointsGetCustomRewardsByIds: async (rewardIds: string[]) => {
    return await apiClient.channelPoints.getCustomRewardsByIds(
      currentUser.id,
      rewardIds
    );
  },
  channelPointsGetCustomRewardById: async (rewardId: string) => {
    return await apiClient.channelPoints.getCustomRewardById(
      currentUser.id,
      rewardId
    );
  },
  channelPointsCreateCustomReward: async (
    rewardData: HelixCreateCustomRewardData
  ) => {
    return await apiClient.channelPoints.createCustomReward(
      currentUser.id,
      rewardData
    );
  },
  channelPointsUpdateCustomReward: async (
    rewardId: string,
    rewardData: HelixCreateCustomRewardData
  ) => {
    return await apiClient.channelPoints.updateCustomReward(
      currentUser.id,
      rewardId,
      rewardData
    );
  },
  channelPointsDeleteCustomReward: async (rewardId: string) => {
    return await apiClient.channelPoints.deleteCustomReward(
      currentUser.id,
      rewardId
    );
  },
  channelPointsGetRedemptionsByIds: async (
    rewardId: string,
    redemptionIds: string[]
  ) => {
    return await apiClient.channelPoints.getRedemptionsByIds(
      currentUser.id,
      rewardId,
      redemptionIds
    );
  },
  channelPointsGetRedemptionById: async (
    rewardId: string,
    redemptionId: string
  ) => {
    return await apiClient.channelPoints.getRedemptionById(
      currentUser.id,
      rewardId,
      redemptionId
    );
  },
  channelPointsGetRedemptionsForBroadcaster: async (
    rewardId: string,
    status: HelixCustomRewardRedemptionStatus,
    filter: HelixPaginatedCustomRewardRedemptionFilter
  ) => {
    return await apiClient.channelPoints.getRedemptionsForBroadcaster(
      currentUser.id,
      rewardId,
      status,
      filter
    );
  },
  channelPointsGetRedemptionsForBroadcasterPaginated: async (
    rewardId: string,
    status: HelixCustomRewardRedemptionStatus,
    filter: HelixPaginatedCustomRewardRedemptionFilter
  ) => {
    return apiClient.channelPoints.getRedemptionsForBroadcasterPaginated(
      currentUser.id,
      rewardId,
      status,
      filter
    );
  },
  channelPointsUpdateRedemptionStatusByIds: async (
    rewardId: string,
    redemptionIds: string[],
    status: HelixCustomRewardRedemptionTargetStatus
  ) => {
    return apiClient.channelPoints.updateRedemptionStatusByIds(
      currentUser.id,
      rewardId,
      redemptionIds,
      status
    );
  },

  // CLip
  clipGetClipsForBroadcaster: async (filter?: HelixPaginatedClipFilter) => {
    return apiClient.clips.getClipsForBroadcaster(currentUser.id, filter);
  },
  getClipsForBroadcasterPaginated: async (filter?: HelixClipFilter) => {
    return apiClient.clips.getClipsForBroadcasterPaginated(
      currentUser.id,
      filter
    );
  },
  getClipsForGame: async (
    gameId: string,
    filter?: HelixPaginatedClipFilter
  ) => {
    return apiClient.clips.getClipsForGame(gameId, filter);
  },
  getClipsForGamePaginated: async (
    gameId: string,
    filter?: HelixClipFilter
  ) => {
    return apiClient.clips.getClipsForGamePaginated(gameId, filter);
  },
  getClipsByIds: async (ids: string[]) => {
    return apiClient.clips.getClipsByIds(ids);
  },
  getClipById: async (id: string) => {
    return apiClient.clips.getClipById(id);
  },
  createClip: async (createAfterDelay?: boolean) => {
    return apiClient.clips.createClip({
      channelId: currentUser.id,
      createAfterDelay,
    });
  },

  // Users
  usersGetUserByName: async (user: string) => {
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
  },
});
