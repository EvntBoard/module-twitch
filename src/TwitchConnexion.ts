import { EvntComNode } from "evntcom-js/dist/node";
import { ChatClient } from "@twurple/chat";
import { PubSubClient, PubSubListener } from "@twurple/pubsub";
import { ApiClient, HelixPrivilegedUser } from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";
import { ETwitchEvent } from "./ETwitchEvent";
import { IConfigItem } from "./ConfigLoader";
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

export class TwitchConnexion {
  private evntCom: EvntComNode;
  private config: IConfigItem;

  private chatClient: ChatClient;
  private pubSubClient: PubSubClient;
  private currentUser: HelixPrivilegedUser;
  private cpListener: PubSubListener<never>;
  private bitsListener: PubSubListener<never>;
  private apiClient: ApiClient;

  private attemps: number = 0;

  constructor(
    evntBoardHost: string,
    evntBoardPort: number,
    config: IConfigItem
  ) {
    this.config = config;
    this.evntCom = new EvntComNode({
      name: config.name,
      port: evntBoardPort,
      host: evntBoardHost,
      events: [ETwitchEvent.OPEN, ETwitchEvent.CLOSE],
    });

    this.evntCom.onEvent = (data: any): void => {
      if (data?.emitter !== config.name) return;
      switch (data?.event) {
        case ETwitchEvent.OPEN:
          this.attemps = 0;
          break;
        case ETwitchEvent.CLOSE:
          this.tryReconnect();
          break;
        default:
          break;
      }
    };

    this.evntCom.onOpen = this.load.bind(this);

    this.evntCom.expose("say", this.say);
    this.evntCom.expose("me", this.me);
    this.evntCom.expose("whisp", this.whisp);
    this.evntCom.expose("addVip", this.addVip);
    this.evntCom.expose("ban", this.ban);
    this.evntCom.expose("changeColor", this.changeColor);
    this.evntCom.expose("clear", this.clear);
    this.evntCom.expose("disableEmoteOnly", this.disableEmoteOnly);
    this.evntCom.expose("disableFollowersOnly", this.disableFollowersOnly);
    this.evntCom.expose("disableR9k", this.disableR9k);
    this.evntCom.expose("disableSlow", this.disableSlow);
    this.evntCom.expose("disableSubsOnly", this.disableSubsOnly);
    this.evntCom.expose("enableEmoteOnly", this.enableEmoteOnly);
    this.evntCom.expose("enableFollowersOnly", this.enableFollowersOnly);
    this.evntCom.expose("enableR9k", this.enableR9k);
    this.evntCom.expose("enableSlow", this.enableSlow);
    this.evntCom.expose("enableSubsOnly", this.enableSubsOnly);
    this.evntCom.expose("getMods", this.getMods);
    this.evntCom.expose("getVips", this.getVips);
    this.evntCom.expose("host", this.host);
    this.evntCom.expose("mod", this.mod);
    this.evntCom.expose("purge", this.purge);
    this.evntCom.expose("raid", this.raid);
    this.evntCom.expose("removeVip", this.removeVip);
    this.evntCom.expose("runCommercial", this.runCommercial);
    this.evntCom.expose("timeout", this.timeout);
    this.evntCom.expose("unmod", this.unmod);
    this.evntCom.expose("unraid", this.unraid);
    this.evntCom.expose("bitsGetLeaderboard", this.bitsGetLeaderboard);
    this.evntCom.expose("bitsGetCheermotes", this.bitsGetCheermotes);

    // Channel

    this.evntCom.expose(
      "channelGetChannelEditors",
      this.channelGetChannelEditors
    );
    this.evntCom.expose("channelGetInfo", this.channelGetInfo);
    this.evntCom.expose("channelUpdateTitle", this.channelUpdateTitle);
    this.evntCom.expose("channelUpdateGame", this.channelUpdateGame);
    this.evntCom.expose("channelUpdateLanguage", this.channelUpdateLanguage);
    this.evntCom.expose("channelStartCommercial", this.channelStartCommercial);

    // ChannelPoint

    this.evntCom.expose(
      "channelPointsGetCustomRewards",
      this.channelPointsGetCustomRewards
    );
    this.evntCom.expose(
      "channelPointsGetCustomRewardsByIds",
      this.channelPointsGetCustomRewardsByIds
    );
    this.evntCom.expose(
      "channelPointsGetCustomRewardById",
      this.channelPointsGetCustomRewardById
    );
    this.evntCom.expose(
      "channelPointsCreateCustomReward",
      this.channelPointsCreateCustomReward
    );
    this.evntCom.expose(
      "channelPointsUpdateCustomReward",
      this.channelPointsUpdateCustomReward
    );
    this.evntCom.expose(
      "channelPointsDeleteCustomReward",
      this.channelPointsDeleteCustomReward
    );
    this.evntCom.expose(
      "channelPointsGetRedemptionsByIds",
      this.channelPointsGetRedemptionsByIds
    );
    this.evntCom.expose(
      "channelPointsGetRedemptionById",
      this.channelPointsGetRedemptionById
    );
    this.evntCom.expose(
      "channelPointsGetRedemptionsForBroadcaster",
      this.channelPointsGetRedemptionsForBroadcaster
    );
    this.evntCom.expose(
      "channelPointsGetRedemptionsForBroadcasterPaginated",
      this.channelPointsGetRedemptionsForBroadcasterPaginated
    );
    this.evntCom.expose(
      "channelPointsUpdateRedemptionStatusByIds",
      this.channelPointsUpdateRedemptionStatusByIds
    );

    // Clips

    this.evntCom.expose(
      "clipGetClipsForBroadcaster",
      this.clipGetClipsForBroadcaster
    );
    this.evntCom.expose(
      "getClipsForBroadcasterPaginated",
      this.getClipsForBroadcasterPaginated
    );
    this.evntCom.expose("getClipsForGame", this.getClipsForGame);
    this.evntCom.expose(
      "getClipsForGamePaginated",
      this.getClipsForGamePaginated
    );
    this.evntCom.expose("getClipsByIds", this.getClipsByIds);
    this.evntCom.expose("getClipById", this.getClipById);
    this.evntCom.expose("createClip", this.createClip);

    // Users
    this.evntCom.expose("usersGetUserByName", this.usersGetUserByName);
  }

  private async load() {
    await this.evntCom.notify("newEvent", [
      ETwitchEvent.LOAD,
      null,
      { emitter: this.config.name },
    ]);

    try {
      const authProvider = new StaticAuthProvider(
        this.config.clientId,
        this.config.accessToken
      );
      this.apiClient = new ApiClient({ authProvider });
      this.pubSubClient = new PubSubClient();
      await this.pubSubClient.registerUserListener(authProvider);

      this.currentUser = await this.apiClient.users.getMe(false);

      this.chatClient = new ChatClient({
        webSocket: true,
        channels: [this.currentUser.name],
        isAlwaysMod: true,
        authProvider,
      });

      this.chatClient.onConnect(() => {
        this.evntCom.notify("newEvent", [
          ETwitchEvent.OPEN,
          null,
          { emitter: this.config.name },
        ]);
      });

      this.chatClient.onDisconnect(async () => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.CLOSE,
          null,
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user redeems channel points
      this.cpListener = await this.pubSubClient.onRedemption(
        this.currentUser.id,
        (msg) => {
          this.evntCom.notify("newEvent", [
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
            { emitter: this.config.name },
          ]);
        }
      );

      this.bitsListener = await this.pubSubClient.onBits(
        this.currentUser.id,
        (msg) => {
          this.evntCom.notify("newEvent", [
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
            { emitter: this.config.name },
          ]);
        }
      );

      // Fires when a user sends a message to a channel.
      this.chatClient.onMessage(async (channel, _, message, msg) => {
        await this.evntCom.notify("newEvent", [
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
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user sends an action (/me) to a channel.
      this.chatClient.onAction(async (channel, _, message, msg) => {
        await this.evntCom.notify("newEvent", [
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
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user is permanently banned from a channel.
      this.chatClient.onBan(async (channel, user) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.BAN,
          { user },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user upgrades their bits badge in a channel.
      this.chatClient.onBitsBadgeUpgrade(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.BITS_BADGE_UPGRADE,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when the chat of a channel is cleared.
      this.chatClient.onChatClear(async (user) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.CHAT_CLEAR,
          { user },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user pays forward a subscription that was gifted to them to the community.
      this.chatClient.onCommunityPayForward(
        async (channel, user, info, msg) => {
          await this.evntCom.notify("newEvent", [
            ETwitchEvent.COMMUNITY_PAY_FORWARD,
            { user, info, msg },
            { emitter: this.config.name },
          ]);
        }
      );

      // Fires when a user gifts random subscriptions to the community of a channel.
      this.chatClient.onCommunitySub(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.COMMUNITY_SUB,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when emote-only mode is toggled in a channel.
      this.chatClient.onEmoteOnly(async (channel, enabled) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.EMOTE_ONLY,
          { enabled },
          { emitter: this.config.name },
        ]);
      });

      // Fires when followers-only mode is toggled in a channel.
      this.chatClient.onFollowersOnly(async (channel, enabled, delay) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.FOLLOWER_ONLY,
          { enabled, delay },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user upgrades their gift subscription to a paid subscription in a channel.
      this.chatClient.onGiftPaidUpgrade(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.GIFT_PAID_UPGRADE,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a channel hosts another channel.
      this.chatClient.onHost(async (channel, target, viewers) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.HOST,
          { target, viewers },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a channel you're logged in as its owner is being hosted by another channel.
      this.chatClient.onHosted(async (channel, byChannel, auto, viewers) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.HOSTED,
          { channel: byChannel, auto, viewers },
          { emitter: this.config.name },
        ]);
      });

      // Fires when Twitch tells you the number of hosts you have remaining in the next half hour for the channel for which you're logged in as owner after hosting a channel.
      this.chatClient.onHostsRemaining(async (channel, numberOfHosts) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.HOST_REMAINING,
          { numberOfHosts },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user joins a channel.
      this.chatClient.onJoin(async (channel, user) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.JOIN,
          { user },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user sends a message to a channel.
      this.chatClient.onPart(async (channel, user) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.PART,
          { user },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user gifts a Twitch Prime benefit to the channel.
      this.chatClient.onPrimeCommunityGift(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.PRIME_COMMUNITY_GIFT,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
      this.chatClient.onPrimePaidUpgrade(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.PRIME_PAID_UPGRADE,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
      this.chatClient.onR9k(async (channel, enabled) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.R9K,
          { enabled },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user raids a channel.
      this.chatClient.onRaid(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.RAID,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user cancels a raid.
      this.chatClient.onRaidCancel(async (channel, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.RAID_CANCEL,
          { msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user resubscribes to a channel.
      this.chatClient.onResub(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.RESUB,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user gifts rewards during a special event.
      this.chatClient.onRewardGift(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.REWARD_GIFT,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user performs a "ritual" in a channel. WTF ?!
      this.chatClient.onRitual(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.RITUAL,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when slow mode is toggled in a channel.
      this.chatClient.onSlow(async (channel, enabled, delay) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.SLOW,
          { enabled, delay },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user pays forward a subscription that was gifted to them to a specific user.
      this.chatClient.onStandardPayForward(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.STANDARD_PAY_FORWARD,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user subscribes to a channel.
      this.chatClient.onSub(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.SUB,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user extends their subscription using a Sub Token.
      this.chatClient.onSubExtend(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.SUB_EXTEND,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user gifts a subscription to a channel to another user.
      this.chatClient.onSubGift(async (channel, user, info, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.SUB_GIFT,
          { user, info, msg },
          { emitter: this.config.name },
        ]);
      });

      // Fires when sub only mode is toggled in a channel.
      this.chatClient.onSubsOnly(async (channel, enabled) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.SUB_ONLY,
          { enabled },
          { emitter: this.config.name },
        ]);
      });

      // Fires when a user is timed out from a channel.
      this.chatClient.onTimeout(async (channel, user, duration) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.TIMEOUT,
          { user, duration },
          { emitter: this.config.name },
        ]);
      });

      // Fires when host mode is disabled in a channel.
      this.chatClient.onUnhost(async (channel) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.UNHOST,
          { channel },
          { emitter: this.config.name },
        ]);
      });

      // Fires when receiving a whisper from another user.
      this.chatClient.onWhisper(async (user, message, msg) => {
        await this.evntCom.notify("newEvent", [
          ETwitchEvent.WHISPER,
          { user, message, msg },
          { emitter: this.config.name },
        ]);
      });

      await this.chatClient.connect();
    } catch (e) {
      await this.evntCom.notify("newEvent", [
        ETwitchEvent.CLOSE,
        null,
        { emitter: this.config.name },
      ]);
    }
  }

  private tryReconnect() {
    this.attemps += 1;
    console.log(`Attempt to reconnect Twitch for the ${this.attemps} time(s)`);
    const waintingTime = this.attemps * 5000;
    setTimeout(this.load.bind(this), waintingTime);
  }

  async unload() {
    if (this.chatClient) {
      await this.chatClient.quit();
    }

    if (this.cpListener) {
      await this.cpListener.remove();
    }

    if (this.bitsListener) {
      await this.bitsListener.remove();
    }

    this.apiClient = undefined;
    this.chatClient = undefined;
    this.currentUser = undefined;
    this.pubSubClient = undefined;
    this.cpListener = undefined;
    this.bitsListener = undefined;
  }

  say = async (message: string, reply: string) => {
    return this.chatClient?.say(this.currentUser.name, message, {
      replyTo: reply,
    });
  };

  me = async (message: string) => {
    return this.chatClient?.action(this.currentUser.name, message);
  };

  whisp = async (user: string, message: string) => {
    return this.chatClient?.whisper(user, message);
  };

  addVip = async (user: string) => {
    return this.chatClient?.addVip(this.currentUser.name, user);
  };

  ban = async (user: string, reason: string) => {
    return this.chatClient?.ban(this.currentUser.name, user, reason);
  };

  changeColor = async (color: string) => {
    return this.chatClient?.changeColor(color);
  };

  clear = async () => {
    return this.chatClient?.clear(this.currentUser.name);
  };

  disableEmoteOnly = async () => {
    return this.chatClient?.disableEmoteOnly(this.currentUser.name);
  };

  disableFollowersOnly = async () => {
    return this.chatClient?.disableFollowersOnly(this.currentUser.name);
  };

  disableR9k = async () => {
    return this.chatClient?.disableR9k(this.currentUser.name);
  };

  disableSlow = async () => {
    return this.chatClient?.disableSlow(this.currentUser.name);
  };

  disableSubsOnly = async () => {
    return this.chatClient?.disableSubsOnly(this.currentUser.name);
  };

  enableEmoteOnly = async () => {
    return this.chatClient?.enableEmoteOnly(this.currentUser.name);
  };

  enableFollowersOnly = async () => {
    return this.chatClient?.enableFollowersOnly(this.currentUser.name);
  };

  enableR9k = async () => {
    return this.chatClient?.enableR9k(this.currentUser.name);
  };

  enableSlow = async () => {
    return this.chatClient?.enableSlow(this.currentUser.name);
  };

  enableSubsOnly = async () => {
    return this.chatClient?.enableSubsOnly(this.currentUser.name);
  };

  getMods = async () => {
    return this.chatClient?.getMods(this.currentUser.name);
  };

  getVips = async () => {
    return this.chatClient?.getMods(this.currentUser.name);
  };

  host = async (channel: string) => {
    return this.chatClient?.host(this.currentUser.name, channel);
  };

  mod = async (user: string) => {
    return this.chatClient?.mod(this.currentUser.name, user);
  };

  purge = async (user: string, reason: string) => {
    return this.chatClient?.purge(this.currentUser.name, user, reason);
  };

  raid = async (channel: string) => {
    return this.chatClient?.raid(this.currentUser.name, channel);
  };

  removeVip = async (user: string) => {
    return this.chatClient?.removeVip(this.currentUser.name, user);
  };

  runCommercial = async (duration: 30 | 60 | 90 | 120 | 150 | 180) => {
    return this.chatClient?.runCommercial(this.currentUser.name, duration);
  };

  timeout = async (user: string, duration: number, reason: string) => {
    return this.chatClient?.timeout(
      this.currentUser.name,
      user,
      duration,
      reason
    );
  };

  unmod = async (user: string) => {
    return this.chatClient?.unmod(this.currentUser.name, user);
  };

  unraid = async (channel: string) => {
    return this.chatClient?.unraid(channel);
  };

  // Bits

  bitsGetLeaderboard = async (data?: HelixBitsLeaderboardQuery) => {
    return await this.apiClient.bits.getLeaderboard(data);
  };

  bitsGetCheermotes = async (channel: string) => {
    return await this.apiClient.bits.getCheermotes(channel);
  };

  // Channel
  channelGetChannelEditors = async () => {
    return await this.apiClient.channels.getChannelEditors(this.currentUser.id);
  };

  channelGetInfo = async () => {
    return await this.apiClient.channels.getChannelInfo(this.currentUser.id);
  };

  channelUpdateTitle = async (title: string) => {
    return await this.apiClient.channels.updateChannelInfo(
      this.currentUser.id,
      {
        title,
      }
    );
  };

  channelUpdateGame = async (game: string) => {
    let gameObj = await this.apiClient.games.getGameByName(game);
    return await this.apiClient.channels.updateChannelInfo(
      this.currentUser.id,
      {
        gameId: gameObj?.id || game,
      }
    );
  };

  channelUpdateLanguage = async (language: string) => {
    return await this.apiClient.channels.updateChannelInfo(
      this.currentUser.id,
      {
        language,
      }
    );
  };

  channelStartCommercial = async (duration: 30 | 60 | 90 | 120 | 150 | 180) => {
    return await this.apiClient.channels.startChannelCommercial(
      this.currentUser.id,
      duration
    );
  };

  // ChannelPointsApi
  channelPointsGetCustomRewards = async (onlyManageable?: boolean) => {
    return await this.apiClient.channelPoints.getCustomRewards(
      this.currentUser.id,
      onlyManageable
    );
  };

  channelPointsGetCustomRewardsByIds = async (rewardIds: string[]) => {
    return await this.apiClient.channelPoints.getCustomRewardsByIds(
      this.currentUser.id,
      rewardIds
    );
  };

  channelPointsGetCustomRewardById = async (rewardId: string) => {
    return await this.apiClient.channelPoints.getCustomRewardById(
      this.currentUser.id,
      rewardId
    );
  };

  channelPointsCreateCustomReward = async (
    rewardData: HelixCreateCustomRewardData
  ) => {
    return await this.apiClient.channelPoints.createCustomReward(
      this.currentUser.id,
      rewardData
    );
  };

  channelPointsUpdateCustomReward = async (
    rewardId: string,
    rewardData: HelixCreateCustomRewardData
  ) => {
    return await this.apiClient.channelPoints.updateCustomReward(
      this.currentUser.id,
      rewardId,
      rewardData
    );
  };

  channelPointsDeleteCustomReward = async (rewardId: string) => {
    return await this.apiClient.channelPoints.deleteCustomReward(
      this.currentUser.id,
      rewardId
    );
  };

  channelPointsGetRedemptionsByIds = async (
    rewardId: string,
    redemptionIds: string[]
  ) => {
    return await this.apiClient.channelPoints.getRedemptionsByIds(
      this.currentUser.id,
      rewardId,
      redemptionIds
    );
  };

  channelPointsGetRedemptionById = async (
    rewardId: string,
    redemptionId: string
  ) => {
    return await this.apiClient.channelPoints.getRedemptionById(
      this.currentUser.id,
      rewardId,
      redemptionId
    );
  };

  channelPointsGetRedemptionsForBroadcaster = async (
    rewardId: string,
    status: HelixCustomRewardRedemptionStatus,
    filter: HelixPaginatedCustomRewardRedemptionFilter
  ) => {
    return await this.apiClient.channelPoints.getRedemptionsForBroadcaster(
      this.currentUser.id,
      rewardId,
      status,
      filter
    );
  };

  channelPointsGetRedemptionsForBroadcasterPaginated = async (
    rewardId: string,
    status: HelixCustomRewardRedemptionStatus,
    filter: HelixPaginatedCustomRewardRedemptionFilter
  ) => {
    return this.apiClient.channelPoints.getRedemptionsForBroadcasterPaginated(
      this.currentUser.id,
      rewardId,
      status,
      filter
    );
  };

  channelPointsUpdateRedemptionStatusByIds = async (
    rewardId: string,
    redemptionIds: string[],
    status: HelixCustomRewardRedemptionTargetStatus
  ) => {
    return this.apiClient.channelPoints.updateRedemptionStatusByIds(
      this.currentUser.id,
      rewardId,
      redemptionIds,
      status
    );
  };

  // CLip
  clipGetClipsForBroadcaster = async (filter?: HelixPaginatedClipFilter) => {
    return this.apiClient.clips.getClipsForBroadcaster(
      this.currentUser.id,
      filter
    );
  };

  getClipsForBroadcasterPaginated = async (filter?: HelixClipFilter) => {
    return this.apiClient.clips.getClipsForBroadcasterPaginated(
      this.currentUser.id,
      filter
    );
  };

  getClipsForGame = async (
    gameId: string,
    filter?: HelixPaginatedClipFilter
  ) => {
    return this.apiClient.clips.getClipsForGame(gameId, filter);
  };

  getClipsForGamePaginated = async (
    gameId: string,
    filter?: HelixClipFilter
  ) => {
    return this.apiClient.clips.getClipsForGamePaginated(gameId, filter);
  };

  getClipsByIds = async (ids: string[]) => {
    return this.apiClient.clips.getClipsByIds(ids);
  };

  getClipById = async (id: string) => {
    return this.apiClient.clips.getClipById(id);
  };

  createClip = async (createAfterDelay?: boolean) => {
    return this.apiClient.clips.createClip({
      channelId: this.currentUser.id,
      createAfterDelay,
    });
  };

  // Users
  usersGetUserByName = async (user: string) => {
    const data = await this.apiClient.users.getUserByName(user);
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
}
