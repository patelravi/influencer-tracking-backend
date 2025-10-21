import { PubSub } from '@google-cloud/pubsub';
import moment from "moment";
import { ScrapperWebhookHandler } from "../services/scrapers/scrapperWebhookHandler";
import { EnvConfig } from "../utils/config";
import { Logger } from "../utils/logger";

const logPrefix = 'ScrapPubsubConsumer:';

export class ScrapWebhookPubsubConsumer {

    private static pubsubConsumer = null;

    public static async startListener() {

        if (ScrapWebhookPubsubConsumer.pubsubConsumer != null) {
            Logger.info(logPrefix, "Listener already running.");
            return;
        }

        // Check if queue is enabled.
        if (!EnvConfig.has('scrap_webhook_pubsub_listener') || EnvConfig.get('scrap_webhook_pubsub_listener').toString() != '1') {
            Logger.info(logPrefix, "Disabled.");
            return;
        }

        const topic = EnvConfig.get('scrap_webhook_pubsub_topic');
        const subscriptionName = EnvConfig.get('scrap_webhook_pubsub_subscription');
        Logger.info(logPrefix, 'Connecting to Pubsub Topic:', topic, '=>', subscriptionName);

        // Instantiates a client
        const pubsubClient = new PubSub();

        // Creates a subscription on that new topic
        const subscription = await pubsubClient.topic(topic).subscription(subscriptionName, {
            flowControl: {
                maxMessages: 10,
            }
        });

        // Receive callbacks for new messages on the subscription
        subscription.on('message', async message => {
            await ScrapWebhookPubsubConsumer.handleMessage(message.data.toString());
            message.ack();
        });

        // Receive callbacks for errors on the subscription
        subscription.on('error', error => {
            console.error('Received error:', error);
        });

        Logger.info("Pubsub: listener initialized.");
    }

    public static async handleMessage(message: string) {
        try {

            const startTime = moment().valueOf();
            Logger.info(logPrefix, `New Pubsub Message: `, message);

            // Extract job information from payload
            const payload = JSON.parse(message);
            const jobId = payload.params.jobId;
            const body = payload.body;

            const webhookHandler = new ScrapperWebhookHandler();
            await webhookHandler.handleWebhook(jobId, body);

            const endTime = moment().valueOf();
            const secondsTaken = ((endTime - startTime) / 1000).toFixed(2);
            Logger.info(logPrefix, `Message processed in:`, secondsTaken, ' Seconds');
        } catch (err) {
            Logger.error(logPrefix, "Error processing message", message, err);
        }
    }
}