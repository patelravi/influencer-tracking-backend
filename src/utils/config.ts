import dotenv from 'dotenv';

export class EnvConfig {
    public static async init() {
        let configFile = null;

        //Read configuration file location from env.
        if (process.env.ENV_FILE_LOCATION) {
            configFile = process.env.ENV_FILE_LOCATION;
        }

        // check file from command line argument
        if (!configFile) {
            process.argv.forEach(function (val) {
                const arr = val.split(':');
                if (arr.length > 0 && arr[0] == 'config') {
                    configFile = arr[1];
                }
            });
        }

        console.log('Config file input:', configFile);

        if (configFile == null) {
            console.info('Configuration file not available, considering .env file at project directory.');
            // require('dotenv').config();
        } else {
            console.info('Reading configuration from', configFile);
            dotenv.config({ path: configFile });
        }
    }

    //Get configuration value method
    public static get(key: string): string {
        if (!process.env.hasOwnProperty(key)) {
            throw new Error('Missing configuration key ' + key);
        } else {
            return process.env[key] as string;
        }
    }


    //Check configuration key exists
    public static has(key: string) {
        if (process.env.hasOwnProperty(key)) {
            return true;
        } else {
            return false;
        }
    }
}
