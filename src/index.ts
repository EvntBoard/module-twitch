import process from 'process';
import { getEvntComClientFromChildProcess, getEvntComServerFromChildProcess } from "evntboard-communicate";
import {ChatClient} from '@twurple/chat';
import {PubSubClient, PubSubListener} from "@twurple/pubsub";
import {ApiClient, HelixPrivilegedUser} from '@twurple/api';
import {StaticAuthProvider} from '@twurple/auth';
import { ETwitchEvent } from './ETwitchEvent';

// parse params
const { name: NAME, customName: CUSTOM_NAME, config: { clientId: CLIENT_ID, token: TOKEN } } = JSON.parse(process.argv[2]);
const EMITTER = CUSTOM_NAME || NAME;

const evntComClient = getEvntComClientFromChildProcess();
const evntComServer = getEvntComServerFromChildProcess();

let chatClient: ChatClient;
let pubSubClient: PubSubClient;
let currentUser: HelixPrivilegedUser;
let cpListener: PubSubListener<never>;
let bitsListener: PubSubListener<never>;
let apiClient: ApiClient;
let attemps: number = 0;

const onNewEvent = ({ event, emitter }: any) => {
    if (emitter !== EMITTER) return;
    switch (event) {
        case ETwitchEvent.OPEN:
            attemps = 0;
            break;
        case ETwitchEvent.CLOSE:
            tryReconnect()
            break;
        default:
            break;
    }
}

const load = async () => {
    evntComClient?.newEvent(ETwitchEvent.LOAD, null, { emitter: EMITTER })
    const authProvider = new StaticAuthProvider(CLIENT_ID, TOKEN);
    apiClient = new ApiClient({authProvider})
    pubSubClient = new PubSubClient()
    await pubSubClient.registerUserListener(authProvider)

    currentUser = await apiClient.helix.users.getMe(false)

    chatClient = new ChatClient(authProvider, { webSocket:true, channels: [currentUser.name], isAlwaysMod: true });

    chatClient.onConnect(() => {
        evntComClient?.newEvent(ETwitchEvent.OPEN, null, { emitter: EMITTER })
    })

    chatClient.onDisconnect(() => {
        evntComClient?.newEvent(ETwitchEvent.CLOSE, null, { emitter: EMITTER })
    })

    // Fires when a user redeems channel points
    cpListener = await pubSubClient.onRedemption(currentUser.id, msg => {
        evntComClient?.newEvent(ETwitchEvent.CHANNEL_POINT, {
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
        }, { emitter: EMITTER })
    })

    bitsListener = await pubSubClient.onBits(currentUser.id, msg => {
        evntComClient?.newEvent(ETwitchEvent.BITS, {
            userId: msg.userId,
            userName: msg.userName,
            bits: msg.bits,
            totalBits: msg.totalBits,
            isAnonymous: msg.isAnonymous,
            message: msg.message,
            msg
        }, { emitter: EMITTER })
    })

    // Fires when a user sends a message to a channel.
    chatClient.onMessage(async (channel, _, message, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.MESSAGE, {
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
            }
        }, { emitter: EMITTER })
    })

    // Fires when a user sends an action (/me) to a channel.
    chatClient.onAction(async (channel, _, message, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.ACTION, {
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
            }
        }, { emitter: EMITTER })
    })

    // Fires when a user is permanently banned from a channel.
    chatClient.onBan(async (channel, user) => {
        await evntComClient?.newEvent(ETwitchEvent.BAN, {user}, { emitter: EMITTER })
    })

    // Fires when a user upgrades their bits badge in a channel.
    chatClient.onBitsBadgeUpgrade(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.BITS_BADGE_UPGRADE, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when the chat of a channel is cleared.
    chatClient.onChatClear(async (user) => {
        await evntComClient?.newEvent(ETwitchEvent.CHAT_CLEAR, {user}, { emitter: EMITTER })
    })

    // Fires when a user pays forward a subscription that was gifted to them to the community.
    chatClient.onCommunityPayForward(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.COMMUNITY_PAY_FORWARD, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user gifts random subscriptions to the community of a channel.
    chatClient.onCommunitySub(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.COMMUNITY_SUB, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when emote-only mode is toggled in a channel.
    chatClient.onEmoteOnly(async (channel, enabled) => {
        await evntComClient?.newEvent(ETwitchEvent.EMOTE_ONLY, {enabled}, { emitter: EMITTER })
    })

    // Fires when followers-only mode is toggled in a channel.
    chatClient.onFollowersOnly(async (channel, enabled, delay) => {
        await evntComClient?.newEvent(ETwitchEvent.FOLLOWER_ONLY, {enabled, delay}, { emitter: EMITTER })
    })

    // Fires when a user upgrades their gift subscription to a paid subscription in a channel.
    chatClient.onGiftPaidUpgrade(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.GIFT_PAID_UPGRADE, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a channel hosts another channel.
    chatClient.onHost(async (channel, target, viewers) => {
        await evntComClient?.newEvent(ETwitchEvent.HOST, {target, viewers}, { emitter: EMITTER })
    })

    // Fires when a channel you're logged in as its owner is being hosted by another channel.
    chatClient.onHosted(async (channel, byChannel, auto, viewers) => {
        await evntComClient?.newEvent(ETwitchEvent.HOSTED, {channel: byChannel, auto, viewers}, { emitter: EMITTER })
    })

    // Fires when Twitch tells you the number of hosts you have remaining in the next half hour for the channel for which you're logged in as owner after hosting a channel.
    chatClient.onHostsRemaining(async (channel, numberOfHosts) => {
        await evntComClient?.newEvent(ETwitchEvent.HOST_REMAINING, {numberOfHosts}, { emitter: EMITTER })
    })

    // Fires when a user joins a channel.
    chatClient.onJoin(async (channel, user) => {
        await evntComClient?.newEvent(ETwitchEvent.JOIN, {user}, { emitter: EMITTER })
    })

    // Fires when a user sends a message to a channel.
    chatClient.onPart(async (channel, user) => {
        await evntComClient?.newEvent(ETwitchEvent.PART, {user}, { emitter: EMITTER })
    })

    // Fires when a user gifts a Twitch Prime benefit to the channel.
    chatClient.onPrimeCommunityGift(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.PRIME_COMMUNITY_GIFT, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
    chatClient.onPrimePaidUpgrade(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.PRIME_PAID_UPGRADE, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user upgrades their Prime subscription to a paid subscription in a channel.
    chatClient.onR9k(async (channel, enabled) => {
        await evntComClient?.newEvent(ETwitchEvent.R9K, {enabled}, { emitter: EMITTER })
    })

    // Fires when a user raids a channel.
    chatClient.onRaid(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.RAID, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user cancels a raid.
    chatClient.onRaidCancel(async (channel, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.RAID_CANCEL, {msg}, { emitter: EMITTER })
    })

    // Fires when a user resubscribes to a channel.
    chatClient.onResub(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.RESUB, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user gifts rewards during a special event.
    chatClient.onRewardGift(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.REWARD_GIFT, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user performs a "ritual" in a channel. WTF ?!
    chatClient.onRitual(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.RITUAL, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when slow mode is toggled in a channel.
    chatClient.onSlow(async (channel, enabled, delay) => {
        await evntComClient?.newEvent(ETwitchEvent.SLOW, {enabled, delay}, { emitter: EMITTER })
    })

    // Fires when a user pays forward a subscription that was gifted to them to a specific user.
    chatClient.onStandardPayForward(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.STANDARD_PAY_FORWARD, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user subscribes to a channel.
    chatClient.onSub(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.SUB, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user extends their subscription using a Sub Token.
    chatClient.onSubExtend(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.SUB_EXTEND, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when a user gifts a subscription to a channel to another user.
    chatClient.onSubGift(async (channel, user, info, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.SUB_GIFT, {user, info, msg}, { emitter: EMITTER })
    })

    // Fires when sub only mode is toggled in a channel.
    chatClient.onSubsOnly(async (channel, enabled) => {
        await evntComClient?.newEvent(ETwitchEvent.SUB_ONLY, {enabled}, { emitter: EMITTER })
    })

    // Fires when a user is timed out from a channel.
    chatClient.onTimeout(async (channel, user, duration) => {
        await evntComClient?.newEvent(ETwitchEvent.TIMEOUT, {user, duration}, { emitter: EMITTER })
    })

    // Fires when host mode is disabled in a channel.
    chatClient.onUnhost(async (channel) => {
        await evntComClient?.newEvent(ETwitchEvent.UNHOST, {channel}, { emitter: EMITTER })
    })

    // Fires when receiving a whisper from another user.
    chatClient.onWhisper(async (user, message, msg) => {
        await evntComClient?.newEvent(ETwitchEvent.WHISPER, {user, message, msg}, { emitter: EMITTER })
    })

    await chatClient.connect()
}

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
    await evntComClient?.newEvent(ETwitchEvent.UNLOAD, null, { emitter: EMITTER });
}

const reload = async () => {
    await unload();
    await load();
}

const tryReconnect = () => {
    attemps += 1;
    console.log(`Attempt to reconnect TWITCH for the ${attemps} time(s)`);
    const waintingTime = attemps * 5000;
    setTimeout(() => load(), waintingTime);
}

const say = (message: string) => chatClient?.say(currentUser.name, message);

const me = (message: string) => chatClient?.action(currentUser.name, message);

const whisp = (user: string, message: string) => chatClient?.whisper(user, message);

// EXPOSE

evntComServer.expose("newEvent", onNewEvent);
evntComServer.expose("load", load);
evntComServer.expose("unload", unload);
evntComServer.expose("reload", reload);
evntComServer.expose("say", say)
evntComServer.expose("me", me)
evntComServer.expose("whisp", whisp)