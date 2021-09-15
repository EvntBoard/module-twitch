import { ConfigLoader } from "./ConfigLoader";
import { TwitchConnexion } from "./TwitchConnexion";

const main = async () => {
  const configLoader = new ConfigLoader();
  await configLoader.load();

  const conf = configLoader.getConfig();

  if (!Array.isArray(conf.config)) {
    if (!conf.config.name) {
      conf.config.name = "twitch";
    }
    new TwitchConnexion(conf.host, conf.port, conf.config);
  } else {
    conf.config.forEach((value, index) => {
      if (!value.name) {
        value.name = `twitch-${index + 1}`;
      }
      new TwitchConnexion(conf.host, conf.port, value);
    });
  }
};

main();
