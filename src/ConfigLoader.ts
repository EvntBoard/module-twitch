import path from "path";
import fs from "fs";

export interface IConfigItem {
  name?: string;
  clientId: string;
  accessToken: string;
}

export interface IConfig {
  host?: string;
  port?: number;
  config: IConfigItem[] | IConfigItem;
}

export class ConfigLoader {
  private _config: IConfig = {
    config: {
      name: "twitch",
      clientId: "sample clientId",
      accessToken: "sample accessToken",
    },
  };

  async load() {
    const configFilePath = path.join(process.cwd(), "config.json");
    if (fs.existsSync(configFilePath)) {
      const configFile = <IConfig>await import(configFilePath);
      this._config = {
        host: configFile.host || process.env.EVNTBOARD_HOST || "localhost",
        port:
          configFile.port ||
          (process.env.EVNTBOARD_PORT
            ? parseInt(process.env.EVNTBOARD_PORT, 10)
            : 5001),
        config: configFile.config,
      };
    } else {
      fs.writeFileSync(configFilePath, JSON.stringify(this._config, null, 2), {
        mode: 0o755,
      });
    }
  }

  getConfig = () => {
    return this._config;
  };
}
